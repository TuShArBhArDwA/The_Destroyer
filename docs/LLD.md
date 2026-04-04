# Low Level Design (LLD)

## Directory Structure
The project is divided into a backend proxy layer and a public-facing static layer.

- `/server.js` - The entry point for the backend logic.
- `/public/` - Contains all frontend logic, stylesheets, and markup.

## Component Breakdown

### Backend Layer

#### 1. Express Server (`server.js`)
- Initializes an HTTP server.
- Serves static files from the `/public` directory.
- `GET /api/news/headlines`: Proxies requests to NewsAPI to fetch top regional headlines based on category filters.
- `GET /api/news/search`: Proxies requests to NewsAPI to execute search queries.
- `POST /api/groq`: The secure gateway for the Editorial Intelligence Engine. Attaches environment-level authorization tokens and routes prompts to the Groq Llama 3.3 model. Supports Server-Sent Events (SSE) for streaming text generation.

### Frontend Layer

#### 1. Editorial Pipeline (`pipeline.js`)
- The core intelligence logic.
- Utilizes prompt engineering instructions to force the LLM to behave strictly as an editorial news writer.
- Contains the robust `parseLLMJson()` interceptor, which sanitizes unstructured or malformed intelligence outputs (specifically parsing escaped control characters) to prevent client crashes.
- Functions: `generateCardContent`, `generateFullArticle`, `generateDigest`, `answerQuestion`.

#### 2. Main Feed Orchestrator (`app.js`)
- Handles the state management for the main catalog interface.
- Executes asynchronous calls to load article thumbnails (cards) and updates the dynamic marquee ticker.
- Renders placeholder "skeleton" visuals to ensure a smooth perceived performance while the intelligent processing takes place in the background.

#### 3. Article Display Controller (`article.js`)
- Manages the progressive rendering of the generated news text.
- Initializes the 'Story Explorer' module, establishing conversational context so users can ask specific questions about the generated article.
- Houses the Web Speech API integration, allowing the browser to read the generated article aloud to the user autonomously.

#### 4. Design System (`style.css`)
- Defines a robust CSS variable hierarchy for instantaneous switching between pure white and deep dark themes based on local storage persistence.
- Employs fluid typography and modern grid layouts to replicate the aesthetics of top-tier publishing houses.
