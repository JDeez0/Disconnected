FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y iproute2 procps curl

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install --force

COPY . .

# Set CI to true for non-interactive expo start
ENV CI=1

# Expose the Expo port
EXPOSE 8081

# Start expo in web mode.
CMD ["npx", "expo", "start", "--web", "--port", "8081", "--lan"]
