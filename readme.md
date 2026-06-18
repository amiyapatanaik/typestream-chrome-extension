# 🎙️ Typestream Voice (Chrome Extension)

**The lightning-fast, privacy-first, open-source alternative to Wispr Flow and Willow Voice.**

![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Available-blue?logo=googlechrome)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Powered by Typestream](https://img.shields.io/badge/Powered%20by-Typestream.dev-indigo)

---

## 🛑 Stop paying $15/month for Voice Dictation

We love tools like Wispr Flow and Willow Voice. They proved that AI-powered voice-to-text is an incredible productivity booster. But here is the problem: **Voice dictation shouldn't be a $15-$20 monthly subscription.** 

If you only dictate a few emails or Slack messages a week, you are massively overpaying. If you use it every day, you're still locked into rigid, expensive tiers.

**Typestream Voice** flips the script. It is a 100% open-source Chrome extension powered by the low-latency <a href="https://typestream.dev" style="background-color: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 6px; text-decoration: none; font-size: 0.85em; font-weight: 500; display: inline-block; border: 1px solid #bae6fd;">&#128279; Typestream API</a>. You bring your own API key, and you **only pay for exactly what you use**. 

With our Pay-As-You-Go (PAYG) model, $1 of credit can last you weeks. It is insane value for money, delivering premium dictation without the subscription fatigue.

### 🥊 How We Compare


| Feature           | Typestream Voice                                             | Subscription Tools (Wispr Flow, etc.) | Native OS Dictation |
| ----------------- | ------------------------------------------------------------ | ------------------------------------- | ------------------- |
| **Pricing Model** | **Pay-As-You-Go** (Pennies per hour)                         | $10 - $20 / month                     | Free                |
| **Accuracy**      | **High** (Whisper-class AI)                                  | High                                  | Medium to Low       |
| **Speed**         | **Fast**                                                     | Fast                                  | Slow / Laggy        |
| **Privacy**       | **Zero Data Retention** (Local keys, History Stored Locally) | Cloud storage / Potential data use    | Varies              |
| **Codebase**      | **Open Source** (MIT)                                        | Closed Source                         | Closed Source       |


---

## ✨ Features

- ⚡ **Talk-Then-Send:** Press your custom hotkey, speak your mind, and release. Your text is cleaned up, formatted and instantly inserted exactly where your cursor is.
- 🔒 **Absolute Privacy:** Your Typestream API key stays securely on your device (`chrome.storage.local`). Furthermore, the Typestream backend operates on a strict **Zero Data Retention** policy. We do not store your audio, and we never train models on your transcripts.
- 📋 **Smart Clipboard Fallback:** Dictating while reading another tab? If your cursor isn't in a text box, the extension automatically copies your dictation to your clipboard for easy pasting.
- 📜 **Local History Log:** Access your recent dictations right from the extension popup. Your history is stored entirely locally.
- 🎨 **Premium UI/UX:** A gorgeous, dark-themed, glassy interface inspired by developer-first design systems. It feels like a native OS app, right in your browser.

---

## 🚀 Getting Started

### Option A: Install from the Chrome Web Store

*(Link coming soon!)*

### Option B: Build from Source

If you prefer to compile it yourself or want to contribute:

1. Clone this repository:
  ```bash
   git clone https://github.com/your-org/typestream-voice-extension.git
   cd typestream-voice-extension
  ```
2. Install dependencies and build:
  ```bash
   npm install
   npm run build
  ```
3. Open Chrome and navigate to `chrome://extensions/`.
4. Enable **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the `dist/` folder from this repository.

---

## 🔑 Setup & Usage

1. **Get an API Key:** Head over to <a href="https://typestream.dev" style="background-color: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 6px; text-decoration: none; font-size: 0.85em; font-weight: 500; display: inline-block; border: 1px solid #bae6fd;">&#128279; typestream.dev</a> and grab a Pay-As-You-Go API key. (New accounts get free starting credits!)
2. **Add to Extension:** Click the Typestream extension icon in your Chrome toolbar and paste your API key.
3. **Set your Hotkey:** Configure your preferred dictation shortcut (e.g., `Cmd+D`).
4. **Start Talking:** Press the hotkey, watch the fluid UI overlay appear, speak, and press again to type.

---

## 🛠️ Powered by Typestream.dev

This extension isn't just a great productivity tool—it's a showcase of the <a href="https://typestream.dev" style="background-color: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 6px; text-decoration: none; font-size: 0.85em; font-weight: 500; display: inline-block; border: 1px solid #bae6fd;">&#128279; Typestream API</a>. 

Typestream is a developer-first, low-latency Speech-to-Text API built for AI agents, dictation tools, and real-time transcription. If you are a developer looking to add voice capabilities to your own SaaS, app, or workflow, check out our docs to see how easy it is to integrate.

---

## 🤝 Contributing

We welcome pull requests! Whether it's adding support for new languages, improving the UI, or optimizing the DOM insertion logic, feel free to open an issue or submit a PR.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.