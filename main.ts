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
	selectedPrompt: 'technical' | 'formal'; // Novo seletor
	promptTechnical: string; // Antigo promptMeeting
	promptFormal: string;    // Novo prompt
}

// 1. Prompt TÉCNICO 
const PROMPT_TECHNICAL = `
# ROLE
Atue como um Especialista em Documentação Técnica e Secretário Executivo Sênior. Seu objetivo é transformar arquivos de áudio brutos em documentação formal estruturada em Markdown.

# INPUT
Você receberá um arquivo de áudio de uma reunião, daily, ou discussão técnica.

# LÓGICA DE CLASSIFICAÇÃO (TAGS)
Analise o conteúdo transcrito e aplique as tags abaixo na seção final, caso o tema seja abordado:
1. **#sistemas**: Se houver menção a softwares de trabalho (Ex: AGHU, Biomega, API, Integrações, ERP).
2. **#infra**: Se houver menção a infraestrutura física/lógica (Ex: PatchCord, Servidor, Cabos, Energia, Switch, Rack).
3. **#adm**: Demandas administrativas (Ex: Processos SEI, Bens e Patrimônio, Controle Financeiro, Contratos).
4. **#suporte**: Suporte N1 e Hardware de ponta (Ex: Chamados, Impressoras, Computadores, Monitores, Mouse).
5. **#telefonia**: Voz e Sonorização (Ex: Protocolo SIP, Linhas analógicas, Arandelas, Microfones, PABX).
6. **#personal**: Âmbito pessoal (Ex: Treino muscular, Leitura, Meditação, Estudos pessoais, Finanças pessoais).

# REGRA ESPECIAL: PRÓXIMAS REUNIÕES (#call)
Se no áudio for agendada ou mencionada uma **próxima reunião/encontro**:
1. Adicione a tag **#call** na lista de tags.
2. Identifique a data dessa futura reunião.
3. Crie uma linha de tarefa no topo da seção "Action Items" estritamente no formato: "- [ ] 🛫 YYYY-MM-DD" (substitua pela data correta).
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

// 2. Prompt FORMAL (Novo: Para Diretoria/Presidência)

const PROMPT_FORMAL = `
# ROLE
Atue como Secretário de Governança Corporativa. Seu objetivo é redigir uma **Ata de Reunião Formal, com linguagem correta, impessoal, objetiva e jurídica, adequada para registros em livros oficiais ou envio a stakeholders de alto nível.

# INPUT
Áudio de uma reunião de Diretoria, Conselho ou Presidência.

# DIRETRIZES DE REDAÇÃO
- **Tom de Voz:** Formal, impessoal e direto (ex: "O Sr. Presidente iniciou...", "O Conselho deliberou...").
- **Não utilize:** Gírias, termos técnicos excessivamente específicos (traduza para linguagem de negócio) ou emojis.
- **Foco:** Em decisões (deliberações), atribuições de responsabilidade e prazos estratégicos.

# OUTPUT FORMAT (MARKDOWN)
Gere o documento estritamente nesta estrutura:

# ATA DE REUNIÃO [ORDINÁRIA/EXTRAORDINÁRIA]

**Data:** [Inserir Data Fornecida no Contexto]
**Início:** [Hora aprox. início] | **Término:** [Hora aprox. fim]
**Local:** [Identificar no áudio ou "Videoconferência"]

## 1. PARTICIPANTES
* **Presidente:** [Nome se houver, ou "Ad hoc"]]
* **Secretário:** [Nome, se houver, ou "Ad hoc"]
* **Presentes:** [Listar nomes e cargos inferidos]

## 2. PAUTA)
(Liste sucintamente os temas principais discutidos)
1.  [Tema A]
2.  [Tema B]

## 3. DELIBERAÇÕES E ENCAMINHAMENTOS

### 3.1. [TEMA A - Título Formal]
**Discussão:** O Sr(a). [Nome] apresentou os pontos referentes a... [Resumo executivo da discussão].
**Decisão:** (Escolha um: O Conselho APROVOU por unanimidade / APROVOU com ressalvas / SOLICITOU revisão). Fica definido que...

### 3.2. [TEMA B - Título Formal]
**Discussão:** Foi debatido o cenário de...
**Decisão:** Determinou-se a criação de um grupo de trabalho para...

## 4. AGENDA FUTURA E PENDÊNCIAS (ACTION ITEMS)
(Se houver agendamentos, use o formato: "- [ ] 🛫 YYYY-MM-DD: [Descrição Formal]")
* **[Responsável]:** [Ação estratégica a realizar] (Prazo: [Data])

---
**Assinaturas:**
(Deixe espaço para assinaturas)
`;

const DEFAULT_SETTINGS: MyPluginSettings = {
	geminiApiKey: '',
	selectedPrompt: 'technical',
	promptTechnical: PROMPT_TECHNICAL,
	promptFormal: PROMPT_FORMAL
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('file-volume', 'Gerar Ata de Reunião (M4A)', async (evt: MouseEvent) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) {
				await this.processMeetingAudio(view.editor, view);
			} else {
				new Notice('Abra uma nota com um arquivo de áudio primeiro.');
			}
		});

		this.addCommand({
			id: 'generate-meeting-report',
			name: 'Gerar Relatório (Usar Prompt Selecionado)',
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

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {
	}

	extractDateFromFilename(filename: string): string {
		// Exemplo: Recording 20230517092121
		const regex = /Recording\s*(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?/;
		const match = filename.match(regex);

		if (match) {
			const [_, year, month, day, hour, minute, second] = match;
			return `${day}/${month}/${year}`; // Para formal, data sem hora fica melhor no campo Data
		}
		
		return "Data não identificada";
	}

	async processMeetingAudio(editor: Editor, view: MarkdownView) {
		if (!this.settings.geminiApiKey) {
			new Notice('⚠️ Erro: Configure a API Key.');
			return;
		}

		const fileContent = editor.getValue();
		const audioFile = this.findAudioFile(fileContent);
		
		if (!audioFile) {
			new Notice('⚠️ Nenhum arquivo .m4a encontrado.');
			return;
		}

		try {
			new Notice(`🎙️ Processando áudio (${this.settings.selectedPrompt})...`);
			
			const arrayBuffer = await this.app.vault.readBinary(audioFile);
			const base64Audio = arrayBufferToBase64(arrayBuffer);
			const estimatedDate = this.extractDateFromFilename(audioFile.basename);
			
			// Seleciona o prompt com base na configuração
			const basePrompt = this.settings.selectedPrompt === 'formal' 
				? this.settings.promptFormal 
				: this.settings.promptTechnical;

			// Injeção de Contexto
			const finalPrompt = `
			${basePrompt}

			---
			CONTEXTO OBRIGATÓRIO (METADADOS DO ARQUIVO):
			Nome do Arquivo: "${audioFile.name}"
			Data da Gravação: "${estimatedDate}"
			
			INSTRUÇÃO: Utilize a data "${estimatedDate}" nos campos de data do cabeçalho.
			`;

			const report = await this.callGeminiApi(base64Audio, finalPrompt);

			if (report) {
				editor.setValue(report);
				new Notice('✅ Ata gerada com sucesso!');
			}

		} catch (error) {
			console.error(error);
			new Notice('❌ Erro ao processar.');
		}
	}

	findAudioFile(content: string): TFile | null {
		const regex = /(?:!\[\[|\[\[)(.*\.m4a)(?:\]\])/i;
		const match = content.match(regex);

		if (match && match[1]) {
			const fileName = match[1].split('|')[0]; 
			return this.app.metadataCache.getFirstLinkpathDest(fileName, '') as TFile;
		}
		return null;
	}

	async callGeminiApi(base64Audio: string, prompt: string): Promise<string | null> {
		const model = 'gemini-2.5-flash'; // Modelo rápido e multimodal
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.settings.geminiApiKey}`;

		const body = {
			contents: [{
				parts: [
					{ text: prompt },
					{
						inline_data: {
							mime_type: "audio/mp4",
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
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.status !== 200) {
				throw new Error(`Gemini API Error: ${response.status}`);
			}

			const data = response.json;
			if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
				return data.candidates[0].content.parts[0].text;
			} else {
				throw new Error('Resposta inválida do Gemini.');
			}

		} catch (error) {
			console.error("Erro API:", error);
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

		// --- SELETOR DE MODELO ---
		new Setting(containerEl)
			.setName('Tipo de Ata Ativa')
			.setDesc('Escolha qual formato será gerado ao executar o comando.')
			.addDropdown(dropdown => dropdown
				.addOption('technical', 'Técnica / Operacional')
				.addOption('formal', 'Formal / Diretoria')
				.setValue(this.plugin.settings.selectedPrompt)
				.onChange(async (value) => {
					this.plugin.settings.selectedPrompt = value as 'technical' | 'formal';
					await this.plugin.saveSettings();
				}));

		// --- PROMPT TÉCNICO ---
		new Setting(containerEl)
			.setName('Prompt Técnico (Operacional)')
			.setDesc('Template para dailies e reuniões técnicas.')
			.addTextArea(text => text
				.setPlaceholder('Prompt técnico...')
				.setValue(this.plugin.settings.promptTechnical)
				.onChange(async (value) => {
					this.plugin.settings.promptTechnical = value;
					await this.plugin.saveSettings();
				}));

		// --- PROMPT FORMAL (A função nova que você pediu) ---
		new Setting(containerEl)
			.setName('Prompt Formal (Diretoria)')
			.setDesc('Template para atas de conselho e reuniões executivas.')
			.addTextArea(text => text
				.setPlaceholder('Prompt formal...')
				.setValue(this.plugin.settings.promptFormal)
				.onChange(async (value) => {
					this.plugin.settings.promptFormal = value;
					await this.plugin.saveSettings();
				}));
	}
}