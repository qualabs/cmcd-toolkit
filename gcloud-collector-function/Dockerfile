# Use an official Node.js runtime as a parent image. Choose the version you need.
FROM node:18-alpine

# Set the working directory to /app. This is where your application code will reside.
WORKDIR /app

# Copy package.json and package-lock.json to the working directory.
# This allows Docker to cache the dependencies installation step if these files don't change.
COPY package*.json ./

# Install any needed dependencies.
RUN npm install

# Copy the rest of the application code from your local directory to the container's /app directory.
COPY . .

# Expose the port your app runs on. Replace 3000 with the actual port if different.
EXPOSE 8080

# Define environment variable (optional, but often useful).
# ENV NODE_ENV production

# Run the app when the container launches.
CMD [ "npm", "run", "start" ]
