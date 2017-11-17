FROM node:8
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --only=production
COPY . .
EXPOSE 4096
CMD ["npm", "start"]
