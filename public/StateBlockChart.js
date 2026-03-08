class StateBlockChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.rows = options.rows || 24;
        this.cols = options.cols || 12;
        this.size = options.size || 16;
        this.baseGap = options.baseGap || 1.5;
        this.colors = options.colors || ['#eee', '#cce5ff', '#99ccff', '#66b2ff', '#3399ff', '#007bff'];
        this.containerId = options.containerId || null;

        this.colGaps = [];
        for (let c = 1; c < this.cols; c++) {
            this.colGaps[c] = (c % 3 === 0) ? this.baseGap * 2 : this.baseGap;
        }
        this.rowGaps = [];
        for (let r = 1; r < this.rows; r++) {
            this.rowGaps[r] = (r % 4 === 0) ? this.baseGap * 4 : this.baseGap;
        }

        this.cellX = [0];
        let accX = this.size;
        for (let c = 1; c < this.cols; c++) {
            accX += this.colGaps[c];
            this.cellX[c] = accX;
            accX += this.size;
        }

        this.cellY = [0];
        let accY = this.size;
        for (let r = 1; r < this.rows; r++) {
            accY += this.rowGaps[r];
            this.cellY[r] = accY;
            accY += this.size;
        }

        let w = this.cols * this.size;
        for (let c = 1; c < this.cols; c++) w += this.colGaps[c];
        let h = this.rows * this.size;
        for (let r = 1; r < this.rows; r++) h += this.rowGaps[r];
        this.canvas.width = w;
        this.canvas.height = h;

        this.createTimeLabels();
        this.createTooltip();
        this.bindEvents();
    }

    getColLeft(col) {
        if (col >= this.cols) {
            return this.canvas.width;
        }
        return this.cellX[col];
    }

    getRowCenter(row) {
        return this.cellY[row] + this.size / 2;
    }

    createTimeLabels() {
        if (!this.containerId) return;
        
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const minuteMarks = [
            { col: 0, text: '0分' },
            { col: 6, text: '30分' },
            { col: 12, text: '60分' }
        ];

        minuteMarks.forEach(mark => {
            const label = document.createElement('div');
            label.className = 'time-label-top';
            label.style.cssText = 'position:absolute;top:-20px;font-size:11px;color:rgba(0,0,0,0.45);transform:translateX(-50%);white-space:nowrap;';
            label.textContent = mark.text;
            label.style.left = this.getColLeft(mark.col) + 'px';
            container.appendChild(label);
        });

        const hourMarks = [0, 4, 8, 12, 16, 20, 23];
        hourMarks.forEach(row => {
            const label = document.createElement('div');
            label.className = 'time-label-left';
            label.style.cssText = 'position:absolute;left:-40px;font-size:11px;color:rgba(0,0,0,0.45);text-align:right;width:32px;transform:translateY(-50%);';
            label.textContent = row + '时';
            label.style.top = this.getRowCenter(row) + 'px';
            container.appendChild(label);
        });
    }

    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'stateblock-tooltip';
        this.tooltip.style.cssText = 'position:absolute;display:none;background:#333;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;pointer-events:none;white-space:nowrap;z-index:100;';
        this.canvas.parentElement.style.position = 'relative';
        this.canvas.parentElement.appendChild(this.tooltip);
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.tooltip.style.display = 'none');
    }

    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        let col = -1, row = -1;
        for (let c = 0; c < this.cols; c++) {
            if (x >= this.cellX[c] && x < this.cellX[c] + this.size) {
                col = c;
                break;
            }
        }
        for (let r = 0; r < this.rows; r++) {
            if (y >= this.cellY[r] && y < this.cellY[r] + this.size) {
                row = r;
                break;
            }
        }
        
        if (col >= 0 && row >= 0) {
            const startHour = row;
            const startMin = col * 5;
            const endMin = startMin + 5;
            const timeStr = `${String(startHour).padStart(2,'0')}:${String(startMin).padStart(2,'0')}-${String(startHour).padStart(2,'0')}:${String(endMin).padStart(2,'0')}`;
            
            this.tooltip.textContent = timeStr;
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = (x + 10) + 'px';
            this.tooltip.style.top = (y - 25) + 'px';
        } else {
            this.tooltip.style.display = 'none';
        }
    }

    render(slots) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const idx = r * this.cols + c;
                const val = Math.min(slots[idx] || 0, 5);
                this.ctx.fillStyle = this.colors[val];

                const x = this.cellX[c];
                const y = this.cellY[r];

                this.ctx.beginPath();
                this.roundRect(x, y, this.size, this.size, 2);
                this.ctx.fill();
            }
        }
    }

    roundRect(x, y, w, h, r) {
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
    }
}
