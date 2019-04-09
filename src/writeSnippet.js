const vscode = require('vscode');
const os = require('os');
const fs = require('fs');
const jsonc = require('jsonc-parser');
const util = require('util');
const { promisify } = util;

const fsExists = promisify(fs.exists);
const fsOpen = promisify(fs.open);
const fsWriteFile = promisify(fs.writeFile);
const fsReadFile = promisify(fs.readFile);

async function writeSnippet(snippet) {
  try {
    const { jsonText, snippets, snippetFile } = await getSnippets(snippet);
    if (snippets[snippet.description] !== undefined) {
      vscode.window.showErrorMessage(
        'A snippet with this description already exists'
      );
      return;
    }

    const edit = jsonc.modify(
      jsonText,
      [snippet.description],
      {
        prefix: snippet.prefix,
        body: snippet.body,
        description: snippet.description
      },
      {
        formattingOptions: {
          // based on default vscode snippet format
          tabSize: 2,
          insertSpaces: false,
          eol: ''
        }
      }
    );

    const fileContent = jsonc.applyEdits(jsonText, edit);
    await fsWriteFile(snippetFile, fileContent);
    vscode.window.showInformationMessage(`Snippet added`);
  } catch (error) {
    console.error('something went wrong trying to get the snippet file');
    return;
  }
}

function getSettingsPath() {
  switch (os.type()) {
    case 'Darwin':
      return process.env.HOME + '/Library/Application Support/Code/User/';
    case 'Linux':
      return process.env.HOME + '/.config/Code/User/';
    case 'Windows_NT':
      return process.env.APPDATA + '\\Code\\User\\';
    default:
      return process.env.HOME + '/.config/Code/User/';
  }
}

function getDirectorySeparator() {
  switch (os.type()) {
    case 'Windows_NT':
      return '\\';
    case 'Darwin':
    case 'Linux':
    default:
      return '/';
  }
}

async function getSnippetFileContents(snippet) {
  const directorySeparator = getDirectorySeparator();
  const settingsPath = getSettingsPath();

  const snippetFile =
    settingsPath +
    util.format('snippets%s.json', directorySeparator + snippet.language);

  if (!(await fsExists(snippetFile))) {
    await fsOpen(snippetFile, 'w+');
    await fsWriteFile(snippetFile, '{}');
  }

  const text = await fsReadFile(snippetFile);
  return { snippetFile, snippetFileContents: text.toString() };
}

async function getSnippets(snippet) {
  const { snippetFile, snippetFileContents } = await getSnippetFileContents(
    snippet
  );

  const parsingErrors = [];
  const snippets = jsonc.parse(snippetFileContents, parsingErrors);

  if (parsingErrors.length > 0) {
    const errors = parsingErrors.map(e => {
      const errorText = `'${jsonc.printParseErrorCode(
        e.error
      )}' error at offset ${e.offset}`;

      return errorText;
    });

    vscode.window.showErrorMessage(
      `Error${parsingErrors.length > 1 ? 's' : ''} on parsing current ${
        snippet.language
      } snippet file: ${errors.join(', ')}`
    );

    throw new Error('Parsing issue');
  }

  return { jsonText: snippetFileContents, snippets, snippetFile };
}

module.exports = writeSnippet;
