#!/usr/bin/env node
//this is demo revert
import { Command } from "commander";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec); // Promisify exec for async/await

// Initialize Commander.js
const program = new Command();

program.version("1.0.0").description("A CLI tool to generate a project setup");

// Helper function to get the latest version of a package from npm
async function getLatestPackageVersion(packageName) {
  try {
    const { stdout } = await execPromise(`npm show ${packageName} version`);
    return stdout.trim(); // Return the latest version as a string
  } catch (error) {
    console.error(`Error fetching version for ${packageName}:`, error);
    return null;
  }
}

// Function to install dependencies dynamically
async function installDependencies(dependencies, projectDir, isDev = false) {
  const depVersions = await Promise.all(
    dependencies.map(async (dep) => {
      const version = await getLatestPackageVersion(dep);
      return `${dep}@${version}`;
    })
  );
  const depList = depVersions.join(" ");
  const installCommand = `npm install ${isDev ? "-D" : ""} ${depList}`;
  exec(installCommand, { cwd: projectDir }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error installing dependencies: ${stderr}`);
      return;
    }
    console.log(`Installed ${isDev ? "dev " : ""}dependencies:`, depList);
  });
}

// Questions for Inquirer.js
const questions = [
  {
    type: "input",
    name: "projectName",
    message: "Enter your project name:",
    default: "my-app",
  },
  {
    type: "list",
    name: "language",
    message: "Select your preferred language:",
    choices: ["JavaScript", "TypeScript"],
  },
  {
    type: "confirm",
    name: "enableCORS",
    message: "Do you want to enable CORS?",
    default: true,
  },
  {
    type: "confirm",
    name: "basicErrorHandler",
    message: "Do you want to use a basic error handler?",
    default: true,
  },
  {
    type: "confirm",
    name: "envFile",
    message: "Do you want to use an environment file?",
    default: true,
  },
  {
    type: "confirm",
    name: "morganLogging",
    message: "Do you want to use Morgan for logging?",
    default: true,
  },
  {
    type: "confirm",
    name: "docker",
    message: "Do you want to use Docker for deployment?",
    default: false,
  },
];

// Prompt the user with questions
inquirer.prompt(questions).then(async (answers) => {
  console.log("\nCreating project with the following configuration:\n");
  console.log(JSON.stringify(answers, null, 2));

  // Create project directory
  const projectDir = path.join(process.cwd(), answers.projectName);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir);
  }

  // Initialize package.json
  exec(`npm init -y`, { cwd: projectDir }, (err, stdout, stderr) => {
    if (err) {
      console.error(`Error initializing package.json: ${stderr}`);
      return;
    }

    // Modify the generated package.json to include npm scripts
    const packageJsonPath = path.join(projectDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    // Define npm run dev and npm run watch based on the language
    if (answers.language === "TypeScript") {
      packageJson.scripts = {
        ...packageJson.scripts,
        dev: "nodemon src/app.ts", // Starts the TypeScript dev server
        watch: "tsc -w", // Watches and compiles TypeScript into dist/
      };
    } else {
      packageJson.scripts = {
        ...packageJson.scripts,
        dev: "nodemon src/app.js", // Starts the JavaScript dev server
        watch: "", // No watch command for JavaScript
      };
    }

    // Write the updated package.json back to disk
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log("Initialized package.json with custom npm scripts: dev, watch");

    // Define the list of dependencies and dev dependencies
    let dependencies = ["express"];
    let devDependencies = ["nodemon"];

    if (answers.enableCORS) {
      dependencies.push("cors");
    }
    if (answers.morganLogging) {
      dependencies.push("morgan");
    }
    if (answers.envFile) {
      dependencies.push("dotenv");
    }
    if (answers.language === "TypeScript") {
      devDependencies.push(
        "typescript",
        "@types/express",
        "@types/node",
        "ts-node"
      );
      // Conditionally add types for CORS and Morgan
      if (answers.enableCORS) devDependencies.push("@types/cors");
      if (answers.morganLogging) devDependencies.push("@types/morgan");
    }

    // Install regular dependencies dynamically
    installDependencies(dependencies, projectDir);

    // Install dev dependencies dynamically
    installDependencies(devDependencies, projectDir, true);

    // Continue with file generation and folder structure creation...
    const srcDir = path.join(projectDir, "src");
    const utilsDir = path.join(srcDir, "utils");
    const folders = [
      "controllers",
      "middlewares",
      "models",
      "routes",
      "tests",
      "lib",
    ];

    // Create src and nested directories
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir);
    }

    folders.forEach((folder) => {
      const folderPath = path.join(srcDir, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    });

    // Create utils directory if it doesn't exist
    if (!fs.existsSync(utilsDir)) {
      fs.mkdirSync(utilsDir);
    }

    // Create ErrorHandler class in utils
    const errorHandlerContent = `export class ErrorHandler extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}`;

    fs.writeFileSync(
      path.join(utilsDir, "errorHandler.ts"),
      errorHandlerContent
    );

    console.log("Created ErrorHandler class in utils/errorHandler.ts");

    // Create basic files (JS or TS based on selection)
    const appFileContent = (enableCORS, morganLogging, envFile, language) => {
      // Start with basic imports
      let imports = "";

      if (language === "TypeScript") {
        imports += `import express from 'express';\n`;
        if (envFile) {
          imports += `import dotenv from 'dotenv';\n`;
        }
        if (enableCORS) {
          imports += `import cors from 'cors';\n`;
        }
        if (morganLogging) {
          imports += `import morgan from 'morgan';\n`;
        }
      } else {
        imports += `const express = require('express');\n`;
        if (envFile) {
          imports += `require('dotenv').config();\n`;
        }
        if (enableCORS) {
          imports += `const cors = require('cors');\n`;
        }
        if (morganLogging) {
          imports += `const morgan = require('morgan');\n`;
        }
      }

      // Start the Express app setup
      let appSetup = `
    const app = express();
    app.use(express.json());
    `;

      // Conditionally configure dotenv for TypeScript
      if (language === "TypeScript" && envFile) {
        appSetup =
          `dotenv.config(); // Load environment variables from .env file\n` +
          appSetup;
      }

      // Conditionally use CORS middleware
      if (enableCORS) {
        appSetup += `app.use(cors()); // Enable CORS\n`;
      }

      // Conditionally use Morgan middleware for logging
      if (morganLogging) {
        appSetup += `app.use(morgan('dev')); // Use Morgan for logging\n`;
      }

      // The rest of the app code (listening on a port, etc.)
      const remainingSetup = `
    const envMode = process.env.NODE_ENV || 'development';  // Default to 'development'
    
    // Define the port from the environment variable or default to 3000
    const port = process.env.PORT || 3000;
    
    // Start the server on the specified port
    app.listen(port, () => {
      console.log(\`Server running in \${envMode} mode on port \${port}\`);
    });
    
    app.get('/', (req, res) => {
      res.send('Hello World');
    });
    `;

      // Export the app and envMode based on the language selected
      if (language === "TypeScript") {
        return (
          imports +
          appSetup +
          remainingSetup +
          "export { app, envMode }; export default app;"
        );
      } else {
        return (
          imports +
          appSetup +
          remainingSetup +
          "module.exports = { app, envMode };"
        );
      }
    };

    // Usage
    const appFilePath =
      answers.language === "TypeScript"
        ? path.join(srcDir, "app.ts")
        : path.join(srcDir, "app.js");

    fs.writeFileSync(
      appFilePath,
      appFileContent(
        answers.enableCORS,
        answers.morganLogging,
        answers.envFile,
        answers.language
      )
    );

    if (answers.envFile) {
      const envContent = `PORT=3000
NODE_ENV=development
`;
      const envFilePath = path.join(projectDir, ".env");
      fs.writeFileSync(envFilePath, envContent);
    }

    // Create tsconfig.json if TypeScript is selected
    if (answers.language === "TypeScript") {
      const tsconfigContent = `{
  "compilerOptions": {
    "target": "ES6",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  },
  "exclude": ["node_modules"]
}`;
      const tsconfigFilePath = path.join(projectDir, "tsconfig.json");
      fs.writeFileSync(tsconfigFilePath, tsconfigContent);
    }

    // Create error.ts middleware in middlewares folder
    const errorMiddlewareContent = `import { NextFunction, Request, Response } from 'express';
import { ErrorHandler } from '../utils/errorHandler'; 
import { envMode } from '../app'; 

const errorMiddleware = (err: ErrorHandler, req: Request, res: Response, next: NextFunction) => {
    err.message = err.message || 'Internal Server Error';
    err.statusCode = err.statusCode || 500;

    const response: {
        success: boolean;
        message: string;
        error?: ErrorHandler;
    } = {
        success: false,
        message: err.message,
    };

    // Add the error object to the response if in development mode
    if (envMode === 'development') {
        response.error = err;
    }

    // Send the structured error response
    res.status(err.statusCode).json(response);
};

export default errorMiddleware;`;

    const errorMiddlewarePath =
      answers.language === "TypeScript"
        ? path.join(srcDir, "middlewares", "error.ts")
        : path.join(srcDir, "middlewares", "error.js");

    fs.writeFileSync(errorMiddlewarePath, errorMiddlewareContent);

    // If Docker is selected, create a Dockerfile
    if (answers.docker) {
      const dockerfileContent = `
FROM node:20

# Create and set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Set the environment variable if using dotenv
${answers.envFile ? "ENV NODE_ENV=production" : ""}

# Expose the application port
EXPOSE 3000

# Define the command to run the application
CMD ["npm", "run", "dev"]
`;

      const dockerFilePath = path.join(projectDir, "Dockerfile");
      fs.writeFileSync(dockerFilePath, dockerfileContent);

      console.log("\nDockerfile created successfully!");
    }

    console.log(
      "\nProject structure created successfully with ErrorHandler class, error middleware, and npm scripts!"
    );
  });
});
