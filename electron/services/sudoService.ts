import * as sudo from '@vscode/sudo-prompt';
import * as os from 'os';

export interface SudoOptions {
  name?: string;
  icns?: string;
  env?: { [key: string]: string };
}

export class SudoService {
  private defaultOptions: SudoOptions;

  constructor() {
    // Set default options for sudo prompt
    this.defaultOptions = {
      name: 'Snap Proxy', // This will appear in the authentication dialog
      icns: undefined, // You can set path to app icon here if needed
    };
  }

  /**
   * Execute a command with sudo privileges using native authentication dialog
   * On macOS, this will show the Touch ID / password dialog
   */
  async exec(command: string, options?: SudoOptions): Promise<{ stdout: string; stderr: string }> {
    const platform = os.platform();
    
    // On Windows, we don't need sudo
    if (platform === 'win32') {
      // For Windows, we can use the command directly or use runas
      // For now, just execute without sudo
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        const result = await execAsync(command);
        return {
          stdout: result.stdout || '',
          stderr: result.stderr || '',
        };
      } catch (error: any) {
        throw new Error(error.message || 'Command execution failed');
      }
    }

    // For macOS and Linux, use sudo-prompt
    return new Promise((resolve, reject) => {
      const sudoOptions: SudoOptions = {
        ...this.defaultOptions,
        name: options?.name || this.defaultOptions.name,
      };

      sudo.exec(command, sudoOptions, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout: stdout?.toString() || '',
          stderr: stderr?.toString() || '',
        });
      });
    });
  }

  /**
   * Execute multiple commands with sudo privileges
   * All commands will be executed with a single authentication prompt
   */
  async execMultiple(commands: string[], options?: SudoOptions): Promise<{ stdout: string; stderr: string }> {
    // Join commands with && to execute them sequentially
    const combinedCommand = commands.join(' && ');
    return this.exec(combinedCommand, options);
  }

  /**
   * Check if we have sudo privileges (cached)
   * This is useful to avoid multiple authentication prompts
   */
  async checkSudoAccess(): Promise<boolean> {
    try {
      await this.exec('echo "sudo access check"');
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const sudoService = new SudoService();