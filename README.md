# Fly Chat Frontend

React + Vite + TypeScript frontend for a Spring Boot chat backend using REST, SockJS, and STOMP.

## Backend contract used

- WebSocket endpoint: `/ws`
- STOMP send destination: `/app/chat.send`
- Room subscription: `/topic/room.{roomId}`
- User queue subscription: `/user/queue/messages`
- Media upload: `POST /api/chat/media`
- Media download: `GET /api/chat/media/{id}/download`
- Room history: `GET /api/chat/history/room/{roomId}`

## Environment variables

Create a `.env` file from `.env.example`.

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=http://localhost:8080
```

Both values default to `http://localhost:8080` if not provided.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the frontend:

```bash
npm run dev
```

3. Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

4. Make sure your Spring Boot backend is running on the same host and port configured in the environment variables.

## Demo flow

1. Enter `user1`, a display name, and a default room like `room-1`.
2. Click `Connect`.
3. Join `room-1` to load room history and subscribe live.
4. Send room messages, direct messages, or upload a file.
5. Open another browser window with `user2` to verify room and direct message delivery.

## Project structure

```text
src/
  api/
    chatApi.ts
  components/
    ChatShell.tsx
    ConnectionPanel.tsx
    DirectMessagePanel.tsx
    MediaMessage.tsx
    MessageComposer.tsx
    MessageList.tsx
    RoomSelector.tsx
    TypingIndicator.tsx
  context/
    ChatContext.tsx
  hooks/
    useChatConnection.ts
    useLocalStorage.ts
    useTypingIndicator.ts
  types/
    chat.ts
  utils/
    dates.ts
    media.ts
  websocket/
    chatSocket.ts
```

## Notes

- No mock data, polling, or third-party chat service is used.
- Relative media download URLs are prefixed with `VITE_API_BASE_URL`.
- Image previews render when the frontend knows the uploaded media content type is an image.
