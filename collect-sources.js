const fs = require('fs').promises;
const path = require('path');

async function collectJavaScriptFiles(directoryPath) {
    try {
        // Check if directory exists
        await fs.access(directoryPath);
        
        // Get the name of the last folder in the path for the output file
        const folderName = path.basename(directoryPath);
        const outputFile = `${folderName}.txt`;
        let output = '';
        
        // Read all files in the directory
        const files = await fs.readdir(directoryPath);
        
        // Filter for .js files and sort them
        const jsFiles = files
            .filter(file => path.extname(file) === '.js')
            .sort();
        
        if (jsFiles.length === 0) {
            console.error('No JavaScript files found in the specified directory');
            process.exit(1);
        }

        // Process each .js file
        for (const file of jsFiles) {
            const filePath = path.join(directoryPath, file);
            
            // Read file contents and append to output string
            const contents = await fs.readFile(filePath, 'utf8');
            output += `\n./${file}\n${contents}\n`;
        }

        // Write the collected contents to the output file
        await fs.writeFile(outputFile, output.trim());
        console.log(`Contents have been written to ${outputFile}`);
        
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.error('Directory not found:', directoryPath);
        } else {
            console.error('An error occurred:', error.message);
        }
        process.exit(1);
    }
}

// Get directory path from command line argument
const directoryPath = process.argv[2];

if (!directoryPath) {
    console.error('Please provide a directory path');
    console.error('Usage: node collect-sources.js <directory-path>');
    process.exit(1);
}

// Run the script
collectJavaScriptFiles(path.resolve(directoryPath));