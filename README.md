<h1 align="center">
  The Destroyer
</h1>

<p align="center">
  <strong>Autonomous AI Editorial. Real Reporting. Independent Perspectives.</strong><br/>
  Automatically ingests live global events and transforms them into premium, long-form journalism and daily digests using an advanced AI pipeline.
</p>

<p align="center">
  <a href="#what-it-does">What It Does</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#how-to-use">How to Use</a> •
  <a href="https://minianonlink.vercel.app/swetashukla">Connect - Sweta</a> •
  <a href="https://minianonlink.vercel.app/tusharbhardwaj">Connect - Tushar</a>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-green?logo=node.js"/>
  <img alt="Groq" src="https://img.shields.io/badge/Groq-llama--3.3--70b-orange"/>
  <img alt="NewsAPI" src="https://img.shields.io/badge/Data-NewsAPI-blue"/>
  <img alt="Vanilla" src="https://img.shields.io/badge/Frontend-Vanilla_JS_CSS-yellow"/>
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow"/>
</p>

---

## What It Does

**The Destroyer** is a fully autonomous AI newsroom. It operates by scanning the world for live, breaking events and dynamically writing professional editorial content.

| Feature | Description |
|---|---|
| **Live Ingestion** | Pulls real-time, unstructured data directly from global wires. |
| **Generative Journalism** | Authors 500+ word professional articles with complete editorial structure. |
| **Daily Briefings** | Synthesizes complex events into a crisp 5-point morning or evening digest. |
| **Story Explorer** | A conversational layer allowing readers to ask hyper-specific questions about the text. |
| **Audio Newsreader** | Utilizes Web Speech API to read the generated article aloud to the user. |
| **Self-Healing LLM Parsing** | Intercepts and corrects native control-character errors in LLM output before they reach the user. |

---

## Premium UI/UX Features

- **Editorial Aesthetics**: Designed to replicate top-tier publishing houses with a strict typographic scale (Serif headlines, Sans-serif body, Monospace metadata).
- **Intelligent Loading States**: Utilizes placeholder skeletons while articles stream progressively to ensure a smooth perceived performance.
- **Dynamic Theming**: Fluid transitions between a pure white Light Mode and a deep, glassmorphic Dark Mode via local storage persistence.
- **Distraction-Free Design**: Focuses purely on reading, eliminating complex funnels or SaaS pricing friction.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend Proxy | Node.js (Express) |
| Architecture | Client-Server API routing |
| AI / LLM Engine | Groq API – `llama-3.3-70b-versatile` |
| Live Data Feed | NewsAPI.org |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript |
| Text-to-Speech | Web Speech API natively integrated |

---

## Project Structure

```
The Destroyer/
├── server.js                # Express Proxy & API Router (Secure environment)
├── public/                  # Static web surface
│   ├── index.html           # Main feed and article mosaic
│   ├── article.html         # Reading view and Story Explorer interface
│   ├── app.js               # Feed orchestration logic
│   ├── article.js           # Progressive reading and text-to-speech logic
│   ├── pipeline.js          # Central AI logic & parsing utility
│   └── style.css            # Root design system and theme variables
├── docs/                    # Architecture documentation
│   ├── HLD.md               # High Level Design
│   └── LLD.md               # Low Level Design
├── .env                     # Environment variables (never commit!)
├── .gitignore               # Excluded configurations
├── package.json             # Backend dependencies
├── LICENSE
└── README.md
```

---

## Architecture & Design Docs

| Document | Description |
|---|---|
| [High Level Design (HLD)](./docs/HLD.md) | System architecture, data flow, component overview, proxy routing model |
| [Low Level Design (LLD)](./docs/LLD.md) | API specs, core module breakdown, formatting engine logic |

---

## Getting Started

### Prerequisites
- Node.js 18+
- Accounts on: Groq, NewsAPI

### 1. Clone & Install

```bash
git clone https://github.com/swetashukla04/Signal.git
cd Signal
npm install
```

### 2. Configure Environment

Create a root `.env` file containing your secure keys:

```text
NEWS_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
# Optional — defaults to llama-3.1-8b-instant (lighter on free-tier limits)
# GROQ_MODEL=llama-3.3-70b-versatile
```

### 3. Run Locally

Start the internal proxy and content server:

```bash
npm start
```

Visit `http://localhost:3000` to read the news.

---

## How to Use

1. Launch the local proxy server as described above.
2. The homepage logic will immediately poll NewsAPI through the secure proxy.
3. Use the top navigation to select a specialized area (e.g., Technology, Business, Science).
4. Click on any breaking card; the intelligence framework will immediately invoke Groq to draft an intensive analysis.
5. In the reading view, interact with the **Story Explorer** chat box at the bottom, or press **Listen** at the top.

---

## Security

- No sensitive API keys are stored on the frontend or committed to version control.
- All intelligence requests are exclusively executed through `server.js` acting as a shielded proxy layer.
- `.env` files are strictly isolated from GitHub interactions via `.gitignore`.
- LLM outputs are processed server-side or sanitized deeply within the pipeline prior to DOM generation.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Connect with Us

If you'd like to connect, feel free to reach out:
- [Sweta Shukla](https://minianonlink.vercel.app/swetashukla)
