FROM node:20-slim

# ffmpeg required for clip extraction and audio processing
RUN apt-get update && apt-get install -y ffmpeg --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

RUN mkdir -p uploads

ENV PORT=3000
EXPOSE 3000

CMD ["node", "src/index.js"]
