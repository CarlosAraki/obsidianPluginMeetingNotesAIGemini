import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	requestUrl,
	arrayBufferToBase64
} from 'obsidian';

// Interface de configurações
interface MyPluginSettings {
	geminiApiKey: string;
	promptMeeting: string;
}

// Prompt Padrão (Conforme solicitado)
const PROMPTDEFAULT = `
# ROLE
Atue como um Especialista em Documentação Técnica e Secretário Executivo Sênior. Seu objetivo é transformar arquivos de áudio brutos em documentação formal estruturada em Markdown.

# INPUT
Você receberá um arquivo de áudio de uma reunião, daily, ou discussão técnica.

# TASK
Analise o áudio, transcreva mentalmente os pontos cruciais e gere um relatório "Post-Mortem" ou "Ata de Reunião" detalhado.

# OUTPUT FORMAT (MARKDOWN)
Gere o output estritamente seguindo esta estrutura:

# 📂 [Título Sugerido Baseado no Assunto]

## 📅 Metadados
- **Data Estimada:** (Se mencionado no áudio, senão "Não identificada")
- **Duração:** [Inserir Duração]
- **Participantes Identificados:**
    - [Nome 1] (Provável papel/cargo inferido pelo contexto)
    - [Nome 2] ...

## 🎯 Objetivo Central
(Resumo de 1 parágrafo sobre o que se trata este áudio)

## 📝 Transcrição Resumida e Tópicos Chave
(Não faça transcrição literal palavra por palavra, mas sim uma narrativa técnica dos pontos discutidos)
* **Tópico 1:** ...
* **Tópico 2:** ...

## 🛠️ Decisões Técnicas & Arquiteturais
(Liste definições sobre códigos, infraestrutura, contratos ou processos)
* [Decisão]

## ⚠️ Pontos de Atenção / Riscos
(Conflitos, bugs críticos, divergências entre vendors, problemas de contrato)

## ✅ Action Items (Próximos Passos)
| Responsável (se houver) | Ação |
| :--- | :--- |
| [Nome] | [Tarefa] |

## 🏷️ Tags
#Tag1 #Tag2 #Tag3
`;

const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiApiKey: '',
	promptMeeting: PROMPTDEFAULT
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// Adiciona o ícone na barra lateral
		this.addRibbonIcon('list-music', 'Gerar Ata de Reunião (M4A)', async (evt: MouseEvent) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) {
				await this.processMeetingAudio(view.editor, view);
			} else {
				new Notice('Abra uma nota com um arquivo de áudio primeiro.');
			}
		});

		// Comando principal acessível via CTRL+P
		this.addCommand({
			id: 'generate-meeting-report',
			name: 'Gerar Relatório de Reunião a partir de Áudio (.m4a)',
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						this.processMeetingAudio(markdownView.editor, markdownView);
					}
					return true;
				}
				return false;
			}
		});

		// Tab de configurações
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
	}

	/**
	 * Função principal de orquestração
	 */
	async processMeetingAudio(editor: Editor, view: MarkdownView) {
		if (!this.settings.geminiApiKey) {
			new Notice('⚠️ Erro: Chave da API Gemini não configurada nas configurações.');
			return;
		}

		const fileContent = editor.getValue();
		
		// 1. Encontrar o arquivo de áudio no texto
		const audioFile = this.findAudioFile(fileContent);
		
		if (!audioFile) {
			new Notice('⚠️ Nenhum arquivo .m4a encontrado na nota atual.');
			return;
		}

		try {
			new Notice(`🎙️ Processando áudio: ${audioFile.name}... (Isso pode demorar)`);
			
			// 2. Ler o arquivo como ArrayBuffer
			const arrayBuffer = await this.app.vault.readBinary(audioFile);
			
			// 3. Converter para Base64
			const base64Audio = arrayBufferToBase64(arrayBuffer);

			// 4. Enviar para Gemini
			const report = await this.callGeminiApi(base64Audio, this.settings.promptMeeting);

			// 5. Substituir conteúdo da nota
			if (report) {
				editor.setValue(report);
				new Notice('✅ Relatório de reunião gerado com sucesso!');
			}

		} catch (error) {
			console.error(error);
			new Notice('❌ Erro ao processar o áudio. Verifique o console (Ctrl+Shift+I). ' + error.message	);
		}
	}

	/**
	 * Procura por links wikilink [[arquivo.m4a]] ou markdown embed ![[arquivo.m4a]]
	 */
	findAudioFile(content: string): TFile | null {
		// Regex para encontrar ![[...m4a]] ou [[...m4a]]
		const regex = /(?:!\[\[|\[\[)(.*\.m4a)(?:\]\])/i;
		const match = content.match(regex);

		if (match && match[1]) {
			const fileName = match[1].split('|')[0]; // Remove alias se houver
			return this.app.metadataCache.getFirstLinkpathDest(fileName, '') as TFile;
		}
		return null;
	}

	/**
	 * Chama a API REST do Google Gemini
	 */
	async callGeminiApi(base64Audio: string, prompt: string): Promise<string | null> {
		const model = 'gemini-2.5-flash'; // Modelo rápido e multimodal
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`;

		const body = {
			contents: [{
				parts: [
					{ text: prompt },
					{
						inline_data: {
							mime_type: "audio/mp4", // m4a geralmente é tratado como mp4 container
							data: base64Audio
						}
					}
				]
			}]
		};

		try {
			const response = await requestUrl({
				url: url,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (response.status !== 200) {
				throw new Error(`Gemini API Error: ${response.status} - ${response.text}`);
			}

			const data = response.json;
			
			// Extração segura do texto da resposta
			if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
				return data.candidates[0].content.parts[0].text;
			} else {
				throw new Error('Formato de resposta inesperado do Gemini.');
			}

		} catch (error) {
			console.error("Erro na requisição Gemini:", error);
			throw error;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Configurações Gemini Meeting AI'});

		new Setting(containerEl)
			.setName('Gemini API Key')
			.setDesc('Sua chave de API do Google AI Studio.')
			.addText(text => text
				.setPlaceholder('Cole sua API Key aqui')
				.setValue(this.plugin.settings.geminiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Prompt do Sistema')
			.setDesc('O prompt que instrui a IA sobre como formatar a ata.')
			.addTextArea(text => text
				.setPlaceholder('Prompt...')
				.setValue(this.plugin.settings.promptMeeting)
				.onChange(async (value) => {
					this.plugin.settings.promptMeeting = value;
					await this.plugin.saveSettings();
				}));
	}
}