# Multi-architecture Dockerfile for Electron GUI app with X11 support
# Supports: linux/amd64, linux/arm64 (Apple Silicon)

FROM node:20-bullseye

# Install system dependencies for Electron and X11
RUN apt-get update && apt-get install -y \
    # FFmpeg for video processing
    ffmpeg \
    # Python for audio sync
    python3 \
    python3-pip \
    python3-venv \
    libsndfile1 \
    # X11 and GUI dependencies
    xvfb \
    x11vnc \
    fluxbox \
    x11-utils \
    # GTK and display libraries
    libgtk-3-0 \
    libgdk-pixbuf2.0-0 \
    libnotify4 \
    # NSS and security
    libnss3 \
    libnspr4 \
    # X11 libraries
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    libxshmfence1 \
    # Additional libraries
    libatspi2.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libexpat1 \
    libgbm1 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libasound2 \
    libappindicator3-1 \
    # System utilities
    ca-certificates \
    fonts-liberation \
    xdg-utils \
    wget \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --legacy-peer-deps

# Install Python dependencies if exists
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then \
    python3 -m pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy application source
COPY src/ ./src/
COPY *.js ./
COPY *.py* ./

# Create necessary directories
RUN mkdir -p temp output

# Set environment variables
ENV NODE_ENV=production \
    DISPLAY=:99 \
    ELECTRON_DISABLE_SANDBOX=1 \
    ELECTRON_ENABLE_LOGGING=1

# Create startup script for X11
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
echo "Starting Xvfb..."\n\
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset &\n\
XVFB_PID=$!\n\
export DISPLAY=:99\n\
\n\
# Wait for X11 to start\n\
echo "Waiting for X11 to start..."\n\
for i in {1..10}; do\n\
    if xdpyinfo -display :99 >/dev/null 2>&1; then\n\
        echo "X11 is ready"\n\
        break\n\
    fi\n\
    echo "Waiting for X11... ($i/10)"\n\
    sleep 1\n\
done\n\
\n\
# Start window manager\n\
echo "Starting fluxbox..."\n\
fluxbox &\n\
\n\
# Start VNC server if enabled\n\
if [ "$ENABLE_VNC" = "true" ]; then\n\
    echo "Starting VNC server on port 5900..."\n\
    x11vnc -display :99 -nopw -forever -shared -rfbport 5900 -rfbportv6 -1 \\\n\
        -o /var/log/x11vnc.log -bg -xkb &\n\
    VNC_PID=$!\n\
    echo "VNC server started (PID: $VNC_PID)"\n\
    sleep 2\n\
fi\n\
\n\
# Cleanup function\n\
cleanup() {\n\
    echo "Shutting down..."\n\
    pkill -P $$ || true\n\
    exit 0\n\
}\n\
\n\
trap cleanup SIGTERM SIGINT\n\
\n\
# Run the application\n\
echo "Starting application..."\n\
exec "$@"\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose VNC port
EXPOSE 5900

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Default command - run Electron app
CMD ["npm", "start"]
