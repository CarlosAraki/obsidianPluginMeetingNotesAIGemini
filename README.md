
# Gemini Meeting Minutes Generator

An Obsidian plugin that automatically generates structured meeting minutes and "post-mortem" reports from audio recordings (`.m4a`) using Google's Gemini 2.5 Flash API.

It transforms raw audio files directly within your vault into professional Markdown documentation, capable of identifying action items, technical decisions, and metadata based on the audio context.

## ✨ Features

  * **Audio to Text:** Transcribes and summarizes `.m4a` files embedded in your notes.
  * **Context Aware:** Automatically extracts the recording date from standard filenames (e.g., `Recording 20230517...`) to populate metadata.
  * **Dual Modes:**
      * **Technical/Operational:** Focuses on systems, infrastructure, and tactical action items. Ideal for dailies and engineering calls.
      * **Formal/Executive:** Uses formal language suitable for board meetings, councils, and official minutes.
  * **Smart Tagging:** Automatically categorizes content (e.g., `#systems`, `#infra`, `#call`) based on the discussion.
  * **Action Items Extraction:** Detects future meetings and creates tasks with dates (e.g., `- [ ] 🛫 2023-12-01`).

## ⚠️ Requirements

  * **Google Gemini API Key:** You need a valid API key from [Google AI Studio](https://aistudio.google.com/).
  * **Audio Format:** Currently supports `.m4a` files (standard iOS/macOS voice memo format).
  * **Internet Connection:** Required to send audio data to the Gemini API.

## 🚀 Installation

### From Community Plugins (Pending)

*Once approved, you can install this plugin via the Obsidian Community Plugins list.*

### Manual Installation

1.  Download the `main.js`, `manifest.json`, and `styles.css` files from the latest Release.
2.  Create a folder named `gemini-meeting-minutes` inside your vault's plugin folder: `<VaultFolder>/.obsidian/plugins/`.
3.  Move the downloaded files into that folder.
4.  Reload Obsidian and enable the plugin in settings.

## ⚙️ Configuration

1.  Go to **Settings** \> **Gemini Meeting AI**.
2.  **Gemini API Key:** Paste your API key here.
3.  **System Prompt:** You can customize the default prompt used to instruct the AI.
4.  **Report Type:** Choose between "Technical" or "Formal" depending on your needs.

## 📖 How to Use

1.  **Drag and drop** an `.m4a` audio file into an Obsidian note.
      * *Tip:* Ensure the link looks like `![[Recording 20230517092121.m4a]]` or `[[Recording 20230517092121.m4a]]`.
2.  **Click the Ribbon Icon** (Microphone 🎙️) on the left sidebar.
      * *Alternative:* Open the Command Palette (`Ctrl/Cmd + P`) and search for **"Gerar Relatório de Reunião"**.
3.  Wait for the notification "Processando áudio...".
4.  Once finished, the content of your note will be replaced by the structured report.

### Date Extraction

To ensure the **"Estimated Date"** metadata is accurate, keep your audio filenames in the standard format: `Recording YYYYMMDDHHMMSS.m4a`. The plugin reads this filename to inject the exact date into the AI context.

## 🔒 Privacy & Security Policy

This plugin makes network requests to **Google's Generative Language API** (Gemini).

  * **Data Transmission:** When you execute the command, the audio file referenced in your active note is converted to Base64 and sent directly to Google's servers for processing.
  * **Data Storage:** This plugin **does not** store your audio or the generated text on any intermediate server. The data goes directly from your Obsidian app to Google.
  * **Third-Party Terms:** By using this plugin, you are subject to [Google's Generative AI Terms of Service](https://policies.google.com/terms/generative-ai). Please ensure you do not upload sensitive or confidential audio if it violates your organization's data policies regarding public AI models.

## 🤝 Contributing

Contributions are welcome\! Please feel free to submit a Pull Request or open an Issue for bugs and feature requests.

## 📄 License

MIT License. See [LICENSE](https://www.google.com/search?q=LICENSE) for more details.

-----

### Disclaimer

This plugin is not affiliated with or endorsed by Google. "Gemini" is a trademark of Google LLC.

