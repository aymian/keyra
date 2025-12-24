# Use Node.js LTS (Long Term Support)
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies (frozen-lockfile ensures exact versions)
RUN pnpm install --no-frozen-lockfile --prod

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

# Start the application
CMD ["node", "app.js"]
