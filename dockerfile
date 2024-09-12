# Build
FROM node:14.17.0-alpine as build

WORKDIR /app

COPY ["./package*.json","yarn.lock",".npmrc","tsconfig.json","./"]
RUN yarn install
RUN npm install -g typescript@4.4.3
COPY . .

# Set the output folder
ENV OUTPUT_DIR=/app/build

# Expose the output folder as a volume
VOLUME $OUTPUT_DIR

# Start the application
CMD ["tsc"]