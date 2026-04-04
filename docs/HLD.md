# High Level Design (HLD)

## Overview
The Signal is structured as a client-server web application. The primary design philosophy is to execute heavy artificial intelligence processing on a secured backend proxy, while providing a fast, responsive user interface on the frontend.

## Architecture Components

1. **Client Interface (Frontend)**
   - Built with raw HTML, CSS, and JavaScript to guarantee maximum performance and zero dependency overhead.
   - Responsible for rendering the news feed, handling user interactions, streaming article generation, and providing accessibility features like Text-to-Speech.

2. **Server Proxy (Backend)**
   - A Node.js environment utilizing the Express framework.
   - Acts as a secure middleman. It intercepts network requests from the frontend and forwards them to external intelligence providers.
   - Prevents sensitive API credentials from being exposed to the public internet.

3. **Global Event Ingestion**
   - The system integrates with external news aggregate APIs to pull live, unstructured data regarding global breaking events.

4. **Editorial Intelligence Engine**
   - Integrating with the Groq API (running the Llama 3.3 Large Language Model).
   - This engine processes the raw event data and generates structured, professional journalism outputs in a highly controlled JSON format.

## Data Flow
1. The user navigates to the web platform.
2. The Client Interface requests current news topics from the Server Proxy.
3. The Server Proxy queries Global Event APIs and returns the raw headlines to the Client Interface.
4. When a user selects a topic, the Client Interface requests a full article generation from the Server Proxy.
5. The Server Proxy communicates with the Editorial Intelligence Engine, streaming the authored article content back to the Client Interface in real-time.
