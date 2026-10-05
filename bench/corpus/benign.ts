// Benign corpus: commands people copy from official documentation every day.
// The false-prompt target (≤ 1% of these) is measured against this list.
//
// Every entry is a command as its project documents it, tagged with the page
// it is copied from and where it gets pasted. Package lists are real package
// ids; installer one-liners are copied from each project's install page.

import type { Sample } from '../types.ts';

type Src = { origin: string; target: Sample['target'] };

const out: Sample[] = [];
let n = 0;
const add = (text: string, s: Src, group: string, copy: Sample['copy'] = 'button', lure?: string[]) =>
  out.push({ id: `benign-${String(++n).padStart(4, '0')}`, label: 'benign', group, text, target: s.target, origin: s.origin, copy, lure });

// ------------------------------------------------------------------ package managers

const WINGET = [
  'Git.Git', 'Microsoft.VisualStudioCode', 'Microsoft.PowerShell', 'Microsoft.WindowsTerminal', 'Python.Python.3.12',
  'OpenJS.NodeJS.LTS', 'Mozilla.Firefox', 'Google.Chrome', 'VideoLAN.VLC', '7zip.7zip', 'Notepad++.Notepad++',
  'Docker.DockerDesktop', 'Microsoft.DotNet.SDK.8', 'GitHub.cli', 'Zoom.Zoom', 'SlackTechnologies.Slack',
  'Discord.Discord', 'Valve.Steam', 'Spotify.Spotify', 'Microsoft.PowerToys', 'JetBrains.IntelliJIDEA.Community',
  'Oracle.JavaRuntimeEnvironment', 'EclipseAdoptium.Temurin.21.JDK', 'Postman.Postman', 'OBSProject.OBSStudio',
  'GIMP.GIMP', 'Audacity.Audacity', 'Microsoft.Teams', 'Rustlang.Rustup', 'GoLang.Go', 'Microsoft.AzureCLI',
  'Amazon.AWSCLI', 'Hashicorp.Terraform', 'Kubernetes.kubectl', 'WinSCP.WinSCP', 'PuTTY.PuTTY', 'WiresharkFoundation.Wireshark',
  'Obsidian.Obsidian', 'Microsoft.Sysinternals.ProcessExplorer', 'voidtools.Everything',
];
for (const id of WINGET) add(`winget install --id ${id} -e`, { origin: `https://learn.microsoft.com/en-us/windows/package-manager/winget/install`, target: 'terminal' }, 'winget');
for (const id of WINGET.slice(0, 10)) add(`winget upgrade --id ${id}`, { origin: 'https://learn.microsoft.com/en-us/windows/package-manager/winget/upgrade', target: 'terminal' }, 'winget');

const CHOCO = [
  'git', 'googlechrome', 'firefox', 'vlc', '7zip', 'notepadplusplus', 'vscode', 'python', 'nodejs-lts', 'jdk8',
  'adobereader', 'putty', 'winscp', 'sysinternals', 'everything', 'docker-desktop', 'curl', 'wget', 'openssh', 'ffmpeg',
  'golang', 'rust', 'terraform', 'kubernetes-cli', 'awscli', 'azure-cli', 'postman', 'obs-studio', 'gimp', 'audacity',
];
for (const p of CHOCO) add(`choco install ${p} -y`, { origin: `https://community.chocolatey.org/packages/${p}`, target: 'terminal' }, 'chocolatey');

const SCOOP = ['git', 'nodejs-lts', 'python', 'go', 'rustup', 'neovim', 'ripgrep', 'fd', 'fzf', 'bat', 'jq', 'curl', 'aria2', 'gh', 'lazygit', 'starship', 'zoxide', 'mingw', 'cmake', 'llvm'];
for (const p of SCOOP) add(`scoop install ${p}`, { origin: 'https://scoop.sh/', target: 'terminal' }, 'scoop');
add('scoop bucket add extras', { origin: 'https://scoop.sh/', target: 'terminal' }, 'scoop');

const BREW = [
  'git', 'node', 'python@3.12', 'go', 'rust', 'wget', 'jq', 'htop', 'tmux', 'neovim', 'ripgrep', 'fd', 'fzf', 'bat',
  'gh', 'pyenv', 'nvm', 'postgresql@16', 'redis', 'mysql', 'sqlite', 'ffmpeg', 'imagemagick', 'tree', 'watch', 'kubectl',
  'helm', 'terraform', 'awscli', 'azure-cli', 'openssl@3', 'gnupg', 'pinentry-mac', 'coreutils', 'yarn', 'pnpm', 'deno', 'bun', 'uv', 'ruff',
];
for (const p of BREW) add(`brew install ${p}`, { origin: `https://formulae.brew.sh/formula/${p}`, target: 'terminal' }, 'homebrew');
const CASKS = ['visual-studio-code', 'google-chrome', 'firefox', 'iterm2', 'docker', 'slack', 'zoom', 'rectangle', 'raycast', 'obsidian', 'spotify', 'vlc'];
for (const p of CASKS) add(`brew install --cask ${p}`, { origin: `https://formulae.brew.sh/cask/${p}`, target: 'terminal' }, 'homebrew');

const PIP = [
  'requests', 'numpy', 'pandas', 'matplotlib', 'scipy', 'scikit-learn', 'flask', 'django', 'fastapi', 'uvicorn',
  'jupyterlab', 'notebook', 'pytest', 'black', 'ruff', 'mypy', 'httpx', 'pydantic', 'sqlalchemy', 'psycopg[binary]',
  'beautifulsoup4', 'lxml', 'selenium', 'playwright', 'pillow', 'opencv-python', 'torch', 'torchvision', 'tensorflow', 'transformers',
  'openai', 'anthropic', 'langchain', 'streamlit', 'gradio', 'boto3', 'google-cloud-storage', 'pyyaml', 'python-dotenv', 'rich',
  'typer', 'click', 'tqdm', 'seaborn', 'plotly', 'polars', 'pyarrow', 'nltk', 'spacy', 'yt-dlp',
];
for (const p of PIP) add(`pip install ${p}`, { origin: `https://pypi.org/project/${p.replace(/\[.*\]/, '')}/`, target: 'terminal' }, 'pip');
for (const p of PIP.slice(0, 10)) add(`python -m pip install --upgrade ${p}`, { origin: `https://pypi.org/project/${p}/`, target: 'terminal' }, 'pip');

const NPM = [
  'react', 'react-dom', 'next', 'vue', 'svelte', 'express', 'axios', 'lodash', 'dayjs', 'zod', 'typescript', 'vite',
  'eslint', 'prettier', 'jest', 'vitest', '@playwright/test', 'tailwindcss', 'postcss', 'autoprefixer', 'prisma', '@prisma/client',
  'mongoose', 'pg', 'redis', 'socket.io', 'dotenv', 'cors', 'jsonwebtoken', 'bcrypt', 'nodemon', 'ts-node', 'tsx', 'esbuild',
  'webpack', 'webpack-cli', 'sass', 'three', 'chart.js', 'd3', 'framer-motion', '@tanstack/react-query', 'zustand', 'react-router-dom',
  'firebase', '@supabase/supabase-js', 'stripe', 'openai', '@anthropic-ai/sdk', 'puppeteer',
];
for (const p of NPM) add(`npm install ${p}`, { origin: `https://www.npmjs.com/package/${p}`, target: 'terminal' }, 'npm');
for (const p of ['typescript', 'pnpm', 'yarn', 'vercel', 'netlify-cli', 'firebase-tools', '@angular/cli', 'nodemon', 'http-server', 'npm-check-updates']) {
  add(`npm install -g ${p}`, { origin: `https://www.npmjs.com/package/${p}`, target: 'terminal' }, 'npm');
}
for (const [cmd, origin] of [
  ['npm create vite@latest my-app -- --template react-ts', 'https://vite.dev/guide/'],
  ['npx create-next-app@latest', 'https://nextjs.org/docs/app/getting-started/installation'],
  ['npm create svelte@latest my-app', 'https://svelte.dev/docs/kit/creating-a-project'],
  ['npx shadcn@latest init', 'https://ui.shadcn.com/docs/installation'],
  ['npx prisma init', 'https://www.prisma.io/docs/getting-started'],
  ['npx playwright install --with-deps', 'https://playwright.dev/docs/intro'],
  ['npm run dev', 'https://vite.dev/guide/'],
  ['npm ci', 'https://docs.npmjs.com/cli/v10/commands/npm-ci'],
  ['npx tsc --init', 'https://www.typescriptlang.org/docs/handbook/compiler-options.html'],
  ['npm audit fix', 'https://docs.npmjs.com/cli/v10/commands/npm-audit'],
]) add(cmd, { origin, target: 'terminal' }, 'npm');

const CARGO = ['ripgrep', 'fd-find', 'bat', 'exa', 'tokei', 'cargo-edit', 'cargo-watch', 'wasm-pack', 'trunk', 'just', 'starship', 'zoxide', 'du-dust', 'hyperfine', 'bottom'];
for (const p of CARGO) add(`cargo install ${p}`, { origin: `https://crates.io/crates/${p}`, target: 'terminal' }, 'cargo');

const GO = ['golang.org/x/tools/gopls@latest', 'github.com/go-delve/delve/cmd/dlv@latest', 'honnef.co/go/tools/cmd/staticcheck@latest', 'github.com/air-verse/air@latest', 'github.com/swaggo/swag/cmd/swag@latest', 'github.com/golangci/golangci-lint/cmd/golangci-lint@latest', 'github.com/jesseduffield/lazygit@latest', 'github.com/charmbracelet/glow@latest'];
for (const p of GO) add(`go install ${p}`, { origin: 'https://go.dev/doc/tutorial/compile-install', target: 'terminal' }, 'go');

const APT = ['git', 'curl', 'build-essential', 'python3-pip', 'python3-venv', 'nginx', 'postgresql', 'redis-server', 'htop', 'tmux', 'vim', 'unzip', 'jq', 'net-tools', 'openssh-server', 'ffmpeg', 'default-jdk', 'nodejs', 'npm', 'docker.io', 'make', 'gcc', 'cmake', 'tree', 'ufw'];
for (const p of APT) add(`sudo apt install -y ${p}`, { origin: 'https://ubuntu.com/server/docs/package-management', target: 'terminal' }, 'apt');
add('sudo apt update && sudo apt upgrade -y', { origin: 'https://ubuntu.com/server/docs/package-management', target: 'terminal' }, 'apt');

const IMAGES = [
  ['nginx', 'docker run --name some-nginx -d -p 8080:80 nginx'],
  ['postgres', 'docker run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -d postgres'],
  ['redis', 'docker run --name some-redis -d redis'],
  ['mysql', 'docker run --name some-mysql -e MYSQL_ROOT_PASSWORD=my-secret-pw -d mysql:8'],
  ['mongo', 'docker run --name some-mongo -d mongo:latest'],
  ['hello-world', 'docker run hello-world'],
  ['ubuntu', 'docker run -it ubuntu bash'],
  ['python', 'docker run -it --rm python:3.12 python'],
  ['node', 'docker run -it --rm node:22 node'],
  ['httpd', 'docker run -dit --name my-apache-app -p 8080:80 httpd:2.4'],
  ['rabbitmq', 'docker run -d --hostname my-rabbit --name some-rabbit rabbitmq:3-management'],
  ['alpine', 'docker run --rm -it alpine:latest sh'],
  ['grafana', 'docker run -d -p 3000:3000 --name=grafana grafana/grafana-enterprise'],
  ['portainer', 'docker volume create portainer_data'],
  ['ollama', 'docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama'],
];
for (const [img, cmd] of IMAGES) add(cmd, { origin: `https://hub.docker.com/_/${img}`, target: 'terminal' }, 'docker');
for (const cmd of ['docker compose up -d', 'docker compose down', 'docker ps -a', 'docker build -t my-app .', 'docker logs -f my-app', 'docker system prune -a', 'docker exec -it my-app sh', 'docker pull nginx:latest']) {
  add(cmd, { origin: 'https://docs.docker.com/reference/cli/docker/', target: 'terminal' }, 'docker');
}

const PSGALLERY = ['Az', 'Microsoft.Graph', 'ExchangeOnlineManagement', 'PSReadLine', 'Pester', 'PSWindowsUpdate', 'posh-git', 'Terminal-Icons', 'PowerShellGet', 'MicrosoftTeams', 'SqlServer', 'ImportExcel', 'dbatools', 'AzureAD', 'PnP.PowerShell'];
for (const m of PSGALLERY) add(`Install-Module -Name ${m} -Scope CurrentUser`, { origin: `https://www.powershellgallery.com/packages/${m}`, target: 'terminal' }, 'psgallery');

for (const t of ['dotnet-ef', 'dotnet-format', 'dotnet-outdated-tool', 'dotnet-script', 'powershell', 'dotnet-counters', 'dotnet-trace', 'dotnet-dump']) {
  add(`dotnet tool install --global ${t}`, { origin: `https://www.nuget.org/packages/${t}`, target: 'terminal' }, 'dotnet');
}
for (const [cmd, origin] of [
  ['gem install rails', 'https://guides.rubyonrails.org/getting_started.html'],
  ['gem install bundler', 'https://bundler.io/'],
  ['bundle install', 'https://bundler.io/'],
  ['composer require laravel/framework', 'https://laravel.com/docs/installation'],
  ['composer create-project laravel/laravel example-app', 'https://laravel.com/docs/installation'],
  ['conda create -n myenv python=3.12', 'https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html'],
  ['conda activate myenv', 'https://docs.conda.io/projects/conda/en/latest/user-guide/tasks/manage-environments.html'],
  ['conda install -c conda-forge jupyterlab', 'https://jupyter.org/install'],
  ['flutter doctor', 'https://docs.flutter.dev/get-started/install'],
  ['flutter create my_app', 'https://docs.flutter.dev/get-started/test-drive'],
  ['rustup update', 'https://www.rust-lang.org/tools/install'],
  ['rustup target add wasm32-unknown-unknown', 'https://rustwasm.github.io/docs/book/'],
  ['nvm install --lts', 'https://github.com/nvm-sh/nvm'],
  ['nvm use 22', 'https://github.com/nvm-sh/nvm'],
  ['pyenv install 3.12.6', 'https://github.com/pyenv/pyenv'],
  ['uv venv', 'https://docs.astral.sh/uv/'],
  ['uv pip install -r requirements.txt', 'https://docs.astral.sh/uv/'],
  ['poetry add requests', 'https://python-poetry.org/docs/basic-usage/'],
  ['pipx install poetry', 'https://python-poetry.org/docs/'],
  ['corepack enable', 'https://nodejs.org/api/corepack.html'],
]) add(cmd, { origin, target: 'terminal' }, 'other-pm');

// ------------------------------------------------------------------ official one-line installers (download and run)

const INSTALLERS: [string, string, Sample['target']][] = [
  ["curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh", 'https://www.rust-lang.org/tools/install', 'terminal'],
  ['curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash', 'https://github.com/nvm-sh/nvm', 'terminal'],
  ['wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash', 'https://github.com/nvm-sh/nvm', 'terminal'],
  ['/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', 'https://brew.sh/', 'terminal'],
  ['Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser\nInvoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression', 'https://scoop.sh/', 'terminal'],
  ['irm get.scoop.sh | iex', 'https://scoop.sh/', 'terminal'],
  ["Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))", 'https://chocolatey.org/install', 'terminal'],
  ['curl -fsSL https://bun.sh/install | bash', 'https://bun.sh/docs/installation', 'terminal'],
  ['powershell -c "irm bun.sh/install.ps1 | iex"', 'https://bun.sh/docs/installation', 'terminal'],
  ['curl -fsSL https://deno.land/install.sh | sh', 'https://docs.deno.com/runtime/getting_started/installation/', 'terminal'],
  ['irm https://deno.land/install.ps1 | iex', 'https://docs.deno.com/runtime/getting_started/installation/', 'terminal'],
  ['curl -LsSf https://astral.sh/uv/install.sh | sh', 'https://docs.astral.sh/uv/getting-started/installation/', 'terminal'],
  ['powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"', 'https://docs.astral.sh/uv/getting-started/installation/', 'terminal'],
  ['curl -sSL https://install.python-poetry.org | python3 -', 'https://python-poetry.org/docs/', 'terminal'],
  ['(Invoke-WebRequest -Uri https://install.python-poetry.org -UseBasicParsing).Content | py -', 'https://python-poetry.org/docs/', 'terminal'],
  ['curl -fsSL https://get.pnpm.io/install.sh | sh -', 'https://pnpm.io/installation', 'terminal'],
  ['Invoke-WebRequest https://get.pnpm.io/install.ps1 -UseBasicParsing | Invoke-Expression', 'https://pnpm.io/installation', 'terminal'],
  ['curl https://get.volta.sh | bash', 'https://docs.volta.sh/guide/getting-started', 'terminal'],
  ['curl -fsSL https://fnm.vercel.app/install | bash', 'https://github.com/Schniz/fnm', 'terminal'],
  ['sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"', 'https://ohmyz.sh/', 'terminal'],
  ['curl -sS https://starship.rs/install.sh | sh', 'https://starship.rs/', 'terminal'],
  ['curl -fsSL https://ollama.com/install.sh | sh', 'https://ollama.com/download', 'terminal'],
  ['irm https://ollama.com/install.ps1 | iex', 'https://ollama.com/download', 'terminal'],
  ['curl -fsSL https://tailscale.com/install.sh | sh', 'https://tailscale.com/download', 'terminal'],
  ['curl -fsSL https://get.docker.com -o get-docker.sh\nsudo sh get-docker.sh', 'https://docs.docker.com/engine/install/ubuntu/', 'terminal'],
  ['curl -sfL https://get.k3s.io | sh -', 'https://docs.k3s.io/quick-start', 'terminal'],
  ['curl -s "https://get.sdkman.io" | bash', 'https://sdkman.io/install', 'terminal'],
  ['curl https://pyenv.run | bash', 'https://github.com/pyenv/pyenv', 'terminal'],
  ['curl https://mise.run | sh', 'https://mise.jdx.dev/getting-started.html', 'terminal'],
  ['curl --proto \'=https\' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install', 'https://determinate.systems/', 'terminal'],
  ['curl -fsSL https://claude.ai/install.sh | bash', 'https://docs.claude.com/en/docs/claude-code/setup', 'terminal'],
  ['irm https://claude.ai/install.ps1 | iex', 'https://docs.claude.com/en/docs/claude-code/setup', 'terminal'],
  ['iex "& { $(irm https://aka.ms/install-powershell.ps1) } -UseMSI"', 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows', 'terminal'],
  ['Invoke-WebRequest -Uri https://dot.net/v1/dotnet-install.ps1 -OutFile dotnet-install.ps1; ./dotnet-install.ps1 -Channel 8.0', 'https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script', 'terminal'],
  ['curl -sSL https://dot.net/v1/dotnet-install.sh | bash /dev/stdin --channel 8.0', 'https://learn.microsoft.com/en-us/dotnet/core/tools/dotnet-install-script', 'terminal'],
  ['curl -sSL https://sdk.cloud.google.com | bash', 'https://cloud.google.com/sdk/docs/downloads-interactive', 'terminal'],
  ['curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"\nsudo installer -pkg AWSCLIV2.pkg -target /', 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html', 'terminal'],
  ['msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi', 'https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html', 'terminal'],
  ['curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash', 'https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-linux', 'terminal'],
  ['curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg', 'https://github.com/cli/cli/blob/trunk/docs/install_linux.md', 'terminal'],
  ['curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg', 'https://docs.docker.com/engine/install/ubuntu/', 'terminal'],
  ['curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -', 'https://github.com/nodesource/distributions', 'terminal'],
  ['curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"', 'https://kubernetes.io/docs/tasks/tools/install-kubectl-linux/', 'terminal'],
  ['curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3\nchmod 700 get_helm.sh\n./get_helm.sh', 'https://helm.sh/docs/intro/install/', 'terminal'],
  ['wget -qO- https://get.pnpm.io/install.sh | ENV="$HOME/.bashrc" SHELL="$(which bash)" bash -', 'https://pnpm.io/installation', 'terminal'],
  ['curl -fsSL https://opencode.ai/install | bash', 'https://opencode.ai/docs/', 'terminal'],
  ['curl -fsSL https://raw.githubusercontent.com/coreybutler/nvm-windows/master/README.md', 'https://github.com/coreybutler/nvm-windows', 'terminal'],
  ['curl -sSf https://rye.astral.sh/get | bash', 'https://rye.astral.sh/guide/installation/', 'terminal'],
  ['curl -fsSL https://code-server.dev/install.sh | sh', 'https://coder.com/docs/code-server/install', 'terminal'],
  ['curl -fsSL https://pixi.sh/install.sh | bash', 'https://pixi.sh/latest/', 'terminal'],
];
for (const [cmd, origin, target] of INSTALLERS) add(cmd, { origin, target }, 'installer');

// ------------------------------------------------------------------ Windows troubleshooting (Microsoft Learn / Support)

const MS = 'https://learn.microsoft.com/en-us/troubleshoot/windows-client/';
const ADMIN: [string, string][] = [
  ['sfc /scannow', 'https://support.microsoft.com/en-us/topic/use-the-system-file-checker-tool-to-repair-missing-or-corrupted-system-files-79aa86cb-ca52-166a-92a3-966e85d4094e'],
  ['DISM.exe /Online /Cleanup-image /Restorehealth', 'https://support.microsoft.com/en-us/topic/use-the-system-file-checker-tool-to-repair-missing-or-corrupted-system-files-79aa86cb-ca52-166a-92a3-966e85d4094e'],
  ['ipconfig /flushdns', `${MS}networking/`],
  ['ipconfig /release\nipconfig /renew', `${MS}networking/`],
  ['ipconfig /all', `${MS}networking/`],
  ['netsh winsock reset', `${MS}networking/`],
  ['netsh int ip reset', `${MS}networking/`],
  ['chkdsk C: /f /r', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/chkdsk'],
  ['wsl --install', 'https://learn.microsoft.com/en-us/windows/wsl/install'],
  ['wsl --update', 'https://learn.microsoft.com/en-us/windows/wsl/install'],
  ['wsl --set-default-version 2', 'https://learn.microsoft.com/en-us/windows/wsl/install'],
  ['Get-ExecutionPolicy -List', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies'],
  ['Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_execution_policies'],
  ['powercfg /batteryreport', 'https://learn.microsoft.com/en-us/windows-hardware/design/component-guidelines/powercfg-command-line-options'],
  ['powercfg /energy', 'https://learn.microsoft.com/en-us/windows-hardware/design/component-guidelines/powercfg-command-line-options'],
  ['Get-ComputerInfo', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-computerinfo'],
  ['Test-NetConnection -ComputerName www.microsoft.com -Port 443', 'https://learn.microsoft.com/en-us/powershell/module/nettcpip/test-netconnection'],
  ['Resolve-DnsName -Name www.bing.com', 'https://learn.microsoft.com/en-us/powershell/module/dnsclient/resolve-dnsname'],
  ['Get-FileHash .\\setup.exe -Algorithm SHA256', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash'],
  ['certutil -hashfile setup.exe SHA256', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil'],
  ['Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All', 'https://learn.microsoft.com/en-us/virtualization/hyper-v-on-windows/quick-start/enable-hyper-v'],
  ['dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart', 'https://learn.microsoft.com/en-us/windows/wsl/install-manual'],
  ['New-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force', 'https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation'],
  ['schtasks /query /fo LIST /v', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/schtasks-query'],
  ['sc query wuauserv', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/sc-query'],
  ['net stop wuauserv\nnet stop bits\nnet start wuauserv\nnet start bits', `${MS}deployment/additional-resources-for-windows-update`],
  ['tasklist /svc', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tasklist'],
  ['taskkill /IM notepad.exe /F', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/taskkill'],
  ['Get-Service | Where-Object {$_.Status -eq "Running"}', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/get-service'],
  ['Restart-Service -Name Spooler', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/restart-service'],
  ['Get-WinEvent -LogName System -MaxEvents 50', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.diagnostics/get-winevent'],
  ['Get-AppxPackage *xbox* | Remove-AppxPackage', 'https://learn.microsoft.com/en-us/powershell/module/appx/remove-appxpackage'],
  ['Get-AppxPackage -AllUsers | Foreach {Add-AppxPackage -DisableDevelopmentMode -Register "$($_.InstallLocation)\\AppXManifest.xml"}', `${MS}shell-experience/`],
  ['wmic bios get serialnumber', 'https://learn.microsoft.com/en-us/windows/win32/wmisdk/wmic'],
  ['Get-CimInstance -ClassName Win32_BIOS', 'https://learn.microsoft.com/en-us/powershell/module/cimcmdlets/get-ciminstance'],
  ['systeminfo', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/systeminfo'],
  ['gpupdate /force', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/gpupdate'],
  ['gpresult /r', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/gpresult'],
  ['shutdown /r /t 0', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/shutdown'],
  ['bcdedit /enum', 'https://learn.microsoft.com/en-us/windows-hardware/drivers/devtest/bcdedit--enum'],
  ['manage-bde -status', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/manage-bde-status'],
  ['Get-BitLockerVolume', 'https://learn.microsoft.com/en-us/powershell/module/bitlocker/get-bitlockervolume'],
  ['Get-MpComputerStatus', 'https://learn.microsoft.com/en-us/powershell/module/defender/get-mpcomputerstatus'],
  ['Update-MpSignature', 'https://learn.microsoft.com/en-us/powershell/module/defender/update-mpsignature'],
  ['Start-MpScan -ScanType QuickScan', 'https://learn.microsoft.com/en-us/powershell/module/defender/start-mpscan'],
  ['netstat -ano', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/netstat'],
  ['tracert www.microsoft.com', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tracert'],
  ['ping -t 8.8.8.8', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping'],
  ['nslookup www.microsoft.com', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/nslookup'],
  ['robocopy C:\\Source D:\\Backup /MIR /R:2 /W:5', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/robocopy'],
  ['Expand-Archive -Path .\\archive.zip -DestinationPath .\\out', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.archive/expand-archive'],
  ['Invoke-WebRequest -Uri https://github.com/PowerShell/PowerShell/releases/download/v7.4.5/PowerShell-7.4.5-win-x64.msi -OutFile PowerShell.msi', 'https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell-on-windows'],
  ['Start-Process powershell -Verb RunAs', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/start-process'],
  ['reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductName', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/reg-query'],
  ['Get-Partition | Get-Volume', 'https://learn.microsoft.com/en-us/powershell/module/storage/get-volume'],
  ['diskpart', 'https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/diskpart'],
  ['winget upgrade --all', 'https://learn.microsoft.com/en-us/windows/package-manager/winget/upgrade'],
  ['Get-WindowsUpdateLog', 'https://learn.microsoft.com/en-us/powershell/module/windowsupdate/get-windowsupdatelog'],
  ['slmgr /xpr', 'https://learn.microsoft.com/en-us/windows-server/get-started/activation-slmgr-vbs-options'],
  ['wsreset.exe', `${MS}shell-experience/`],
];
for (const [cmd, origin] of ADMIN) add(cmd, { origin, target: 'terminal' }, 'windows-admin');

// ------------------------------------------------------------------ Run box (Win+R) — tutorials really do say "press Win+R"

const RUN = [
  'appwiz.cpl', 'control', 'msconfig', 'ms-settings:windowsupdate', '%temp%', 'devmgmt.msc', 'services.msc', 'regedit',
  'cmd', 'powershell', 'winver', 'dxdiag', 'mstsc', 'notepad', 'ncpa.cpl', 'sysdm.cpl', 'taskmgr', 'eventvwr.msc',
  'gpedit.msc', 'shell:startup', '%appdata%', 'cleanmgr', 'mrt', 'msinfo32', 'diskmgmt.msc', 'compmgmt.msc',
  'control printers', 'ms-settings:network-status', 'resmon', 'perfmon /rel', 'mdsched', 'optionalfeatures',
  'firewall.cpl', 'inetcpl.cpl', 'main.cpl', 'mmsys.cpl', 'shell:downloads', 'wt', 'osk', 'calc',
];
for (const r of RUN) add(r, { origin: 'https://support.microsoft.com/en-us/windows/', target: 'run' }, 'run-box', 'manual', ['Win+R']);

// ------------------------------------------------------------------ File Explorer address bar

const EXPLORER = [
  '%USERPROFILE%\\Downloads', 'C:\\Users\\Public\\Documents', '\\\\fileserver\\shared\\Projects', 'shell:Downloads', '%LOCALAPPDATA%',
  'C:\\Program Files', 'shell:AppsFolder', 'C:\\Windows\\Fonts', '%ProgramData%\\Microsoft\\Windows\\Start Menu\\Programs', 'shell:sendto',
];
for (const e of EXPLORER) add(e, { origin: 'https://support.microsoft.com/en-us/windows/', target: 'explorer' }, 'explorer', 'manual');

// ------------------------------------------------------------------ everyday developer commands

const DEV: [string, string][] = [
  ['git clone https://github.com/microsoft/vscode.git', 'https://github.com/microsoft/vscode'],
  ['git clone https://github.com/facebook/react.git', 'https://github.com/facebook/react'],
  ['git config --global user.name "Your Name"', 'https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup'],
  ['git config --global user.email "you@example.com"', 'https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup'],
  ['git checkout -b feature/login', 'https://git-scm.com/docs/git-checkout'],
  ['git pull --rebase origin main', 'https://git-scm.com/docs/git-pull'],
  ['git log --oneline --graph --all', 'https://git-scm.com/docs/git-log'],
  ['git stash && git pull && git stash pop', 'https://git-scm.com/docs/git-stash'],
  ['git reset --hard HEAD~1', 'https://stackoverflow.com/questions/927358/how-do-i-undo-the-most-recent-local-commits-in-git'],
  ['git remote add origin https://github.com/user/repo.git', 'https://docs.github.com/en/get-started/getting-started-with-git/managing-remote-repositories'],
  ['ssh-keygen -t ed25519 -C "your_email@example.com"', 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent'],
  ['eval "$(ssh-agent -s)"', 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent'],
  ['Get-Service -Name ssh-agent | Set-Service -StartupType Manual', 'https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent'],
  ['gh auth login', 'https://cli.github.com/manual/gh_auth_login'],
  ['gh repo clone cli/cli', 'https://cli.github.com/manual/gh_repo_clone'],
  ['python -m venv .venv', 'https://docs.python.org/3/library/venv.html'],
  ['.venv\\Scripts\\activate', 'https://docs.python.org/3/library/venv.html'],
  ['source .venv/bin/activate', 'https://docs.python.org/3/library/venv.html'],
  ['pip install -r requirements.txt', 'https://pip.pypa.io/en/stable/user_guide/'],
  ['python manage.py runserver', 'https://docs.djangoproject.com/en/5.1/intro/tutorial01/'],
  ['flask --app hello run', 'https://flask.palletsprojects.com/en/stable/quickstart/'],
  ['uvicorn main:app --reload', 'https://fastapi.tiangolo.com/tutorial/first-steps/'],
  ['jupyter lab', 'https://jupyter.org/install'],
  ['kubectl apply -f https://raw.githubusercontent.com/kubernetes/dashboard/v2.7.0/aio/deploy/recommended.yaml', 'https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/'],
  ['kubectl get pods -A', 'https://kubernetes.io/docs/reference/kubectl/quick-reference/'],
  ['kubectl port-forward svc/my-service 8080:80', 'https://kubernetes.io/docs/tasks/access-application-cluster/port-forward-access-application-cluster/'],
  ['helm repo add bitnami https://charts.bitnami.com/bitnami', 'https://helm.sh/docs/intro/quickstart/'],
  ['terraform init && terraform plan', 'https://developer.hashicorp.com/terraform/tutorials/aws-get-started/aws-build'],
  ['aws configure', 'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html'],
  ['az login', 'https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli'],
  ['gcloud init', 'https://cloud.google.com/sdk/docs/initializing'],
  ['firebase deploy', 'https://firebase.google.com/docs/cli'],
  ['vercel --prod', 'https://vercel.com/docs/cli'],
  ['echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null', 'https://docs.docker.com/engine/install/ubuntu/'],
  ['sudo usermod -aG docker $USER', 'https://docs.docker.com/engine/install/linux-postinstall/'],
  ['sudo systemctl enable --now docker', 'https://docs.docker.com/engine/install/linux-postinstall/'],
  ['chmod +x ./gradlew && ./gradlew build', 'https://docs.gradle.org/current/userguide/gradle_wrapper.html'],
  ['mvn clean install', 'https://maven.apache.org/guides/getting-started/'],
  ['./mvnw spring-boot:run', 'https://spring.io/guides/gs/spring-boot'],
  ['cargo new hello_world && cd hello_world && cargo run', 'https://doc.rust-lang.org/book/ch01-03-hello-cargo.html'],
  ['go mod init example.com/hello', 'https://go.dev/doc/tutorial/getting-started'],
  ['go run .', 'https://go.dev/doc/tutorial/getting-started'],
  ['dotnet new console -o MyApp && cd MyApp && dotnet run', 'https://learn.microsoft.com/en-us/dotnet/core/tutorials/with-visual-studio-code'],
  ['powershell -ExecutionPolicy Bypass -File .\\build.ps1', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_pwsh'],
  ['Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-executionpolicy'],
  ['code .', 'https://code.visualstudio.com/docs/setup/windows'],
  ['echo $PATH', 'https://askubuntu.com/questions/'],
  ['export PATH="$HOME/.local/bin:$PATH"', 'https://docs.astral.sh/uv/'],
  ['[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\\tools", "User")', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_environment_variables'],
  ['tar -xzf node-v22.9.0-linux-x64.tar.gz', 'https://nodejs.org/en/download'],
  ['wget https://nodejs.org/dist/v22.9.0/node-v22.9.0-linux-x64.tar.xz', 'https://nodejs.org/en/download'],
  ['curl -O https://www.python.org/ftp/python/3.12.6/python-3.12.6-amd64.exe', 'https://www.python.org/downloads/'],
  ['base64 -d encoded.txt > decoded.bin', 'https://man7.org/linux/man-pages/man1/base64.1.html'],
  ['echo "SGVsbG8=" | base64 --decode', 'https://stackoverflow.com/questions/16918602/how-to-base64-encode-image-in-linux-bash-shell'],
  ['[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))', 'https://stackoverflow.com/questions/42592518/'],
  ['openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes', 'https://stackoverflow.com/questions/10175812/'],
  ['curl -X POST https://api.github.com/user/repos -H "Authorization: Bearer $TOKEN" -d \'{"name":"demo"}\'', 'https://docs.github.com/en/rest/repos/repos'],
  ['curl -s https://api.github.com/repos/cli/cli/releases/latest | jq -r .tag_name', 'https://docs.github.com/en/rest/releases/releases'],
  ['Invoke-RestMethod -Uri https://api.github.com/repos/PowerShell/PowerShell/releases/latest', 'https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-restmethod'],
  ['crontab -e', 'https://man7.org/linux/man-pages/man1/crontab.1.html'],
  ['history | grep ssh', 'https://askubuntu.com/questions/'],
  ['sudo ufw allow 22/tcp && sudo ufw enable', 'https://ubuntu.com/server/docs/firewalls'],
  ['ssh user@192.168.1.10', 'https://www.ssh.com/academy/ssh/command'],
  ['scp file.txt user@192.168.1.10:/home/user/', 'https://www.ssh.com/academy/ssh/scp'],
  ['python3 -m http.server 8000', 'https://docs.python.org/3/library/http.server.html'],
  ['npx serve .', 'https://www.npmjs.com/package/serve'],
  ['ngrok http 8080', 'https://ngrok.com/docs/getting-started/'],
  ['xattr -d com.apple.quarantine /Applications/MyApp.app', 'https://support.apple.com/en-us/102445'],
  ['sudo spctl --master-enable', 'https://support.apple.com/en-us/102445'],
  ['softwareupdate --install-rosetta --agree-to-license', 'https://support.apple.com/en-us/102527'],
  ['xcode-select --install', 'https://developer.apple.com/documentation/xcode/installing-the-command-line-tools/'],
  ['defaults write com.apple.finder AppleShowAllFiles YES; killall Finder', 'https://apple.stackexchange.com/questions/'],
];
for (const [cmd, origin] of DEV) add(cmd, { origin, target: 'terminal' }, 'developer');

export const BENIGN: Sample[] = out;
