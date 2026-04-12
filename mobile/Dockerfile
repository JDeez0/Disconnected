FROM node:20-slim

# Install net-tools for troubleshooting
RUN apt-get update && apt-get install -y iproute2 procps

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

# Set CI to true for non-interactive expo start
ENV CI=1

# Expose the Expo port
EXPOSE 8081

# Start expo in web mode. Use --lan to allow network access.
CMD ["npx", "expo", "start", "--web", "--port", "8081", "--lan"]
