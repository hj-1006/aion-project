FROM node:18-alpine
WORKDIR /app
# Ansible for API (LLM network queries / show commands)
RUN apk add --no-cache python3 py3-pip openssh-client \
  && pip3 install --break-system-packages ansible ansible-pylibssh
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
EXPOSE 5514/udp
CMD ["node", "server.js"]
