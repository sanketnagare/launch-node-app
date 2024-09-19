#!/usr/bin/env node

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

    // Define npm run dev and npm run watch
    packageJson.scripts = {
      ...packageJson.scripts,
      dev: "nodemon src/app.ts", // Starts the development server
      watch: "tsc -w", // Watches and compiles TypeScript into dist/
    };

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

    // Create basic files
    const appFileContent = (enableCORS, morganLogging, envFile) => {
      // Start with basic imports
      let imports = `
import express from 'express';
`;

      // Conditionally add dotenv import
      if (envFile) {
        imports += `import dotenv from 'dotenv';\n`;
      }

      // Conditionally add CORS import
      if (enableCORS) {
        imports += `import cors from 'cors';\n`;
      }

      // Conditionally add Morgan import
      if (morganLogging) {
        imports += `import morgan from 'morgan';\n`;
      }

      // Start the Express app setup
      let appSetup = `
const app = express();
app.use(express.json());
`;

      // Conditionally configure dotenv
      if (envFile) {
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
export const envMode = process.env.NODE_ENV || 'development';  // Default to 'development'

// Define the port from the environment variable or default to 3000
const port = process.env.PORT || 3000;

// Start the server on the specified port
app.listen(port, () => {
  console.log(\`Server running in \${envMode} mode on port \${port}\`);
});

app.get('/', (req, res) => {
  res.send('Hello World');
});

export default app;
`;

      // Return the full content with imports, conditional middleware, and the rest of the app
      return imports + appSetup + remainingSetup;
    };

    // Usage
    const appFilePath = path.join(srcDir, "app.ts");
    fs.writeFileSync(
      appFilePath,
      appFileContent(answers.enableCORS, answers.morganLogging, answers.envFile)
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

    const errorMiddlewarePath = path.join(srcDir, "middlewares", "error.ts");
    fs.writeFileSync(errorMiddlewarePath, errorMiddlewareContent);

    console.log(
      "\nProject structure created successfully with ErrorHandler class, error middleware, and npm scripts!"
    );
  });
});
