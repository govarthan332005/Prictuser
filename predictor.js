// AI Prediction Engine - Hybrid Algorithm
// Combines: Markov Chain, Pattern Matching, Streak Analysis, Frequency Analysis

class DragonTigerPredictor {
    constructor() {
        this.trainingData = [];
        this.markovTable = {};
        this.patternMap = {};
        this.minConfidence = 90;
        this.mode = 'hybrid';
    }

    normalize(signal) {
        if (!signal) return null;
        const s = String(signal).trim().toLowerCase();
        if (s === 'd' || s === 'dragon' || s === '🐉') return 'D';
        if (s === 't' || s === 'tiger' || s === '🐅') return 'T';
        if (s === 'tie' || s === 'draw' || s === '🤝' || s === 'ti') return 'Tie';
        return null;
    }

    setTrainingData(records) {
        this.trainingData = records.map(r => this.normalize(r)).filter(Boolean);
        this.buildMarkov();
        this.buildPatterns();
    }

    buildMarkov() {
        // 2nd & 3rd order Markov chain
        this.markovTable = { o2: {}, o3: {}, o4: {} };
        const data = this.trainingData;

        for (let i = 0; i < data.length - 2; i++) {
            const key2 = data[i] + data[i+1];
            const next = data[i+2];
            if (!this.markovTable.o2[key2]) this.markovTable.o2[key2] = { D: 0, T: 0, Tie: 0 };
            this.markovTable.o2[key2][next]++;
        }
        for (let i = 0; i < data.length - 3; i++) {
            const key3 = data[i] + data[i+1] + data[i+2];
            const next = data[i+3];
            if (!this.markovTable.o3[key3]) this.markovTable.o3[key3] = { D: 0, T: 0, Tie: 0 };
            this.markovTable.o3[key3][next]++;
        }
        for (let i = 0; i < data.length - 4; i++) {
            const key4 = data[i] + data[i+1] + data[i+2] + data[i+3];
            const next = data[i+4];
            if (!this.markovTable.o4[key4]) this.markovTable.o4[key4] = { D: 0, T: 0, Tie: 0 };
            this.markovTable.o4[key4][next]++;
        }
    }

    buildPatterns() {
        // Pattern frequency map of length-5 sequences
        this.patternMap = {};
        const data = this.trainingData;
        for (let len = 3; len <= 6; len++) {
            for (let i = 0; i + len < data.length; i++) {
                const pattern = data.slice(i, i + len).join('');
                const next = data[i + len];
                if (!this.patternMap[pattern]) this.patternMap[pattern] = { D: 0, T: 0, Tie: 0 };
                this.patternMap[pattern][next]++;
            }
        }
    }

    // Markov-based prediction (highest order match wins)
    predictMarkov(input) {
        const seq = input.map(s => this.normalize(s)).filter(Boolean);
        if (seq.length === 0) return null;

        const orders = [
            { key: seq.slice(-4).join(''), table: this.markovTable.o4, weight: 4 },
            { key: seq.slice(-3).join(''), table: this.markovTable.o3, weight: 3 },
            { key: seq.slice(-2).join(''), table: this.markovTable.o2, weight: 2 }
        ];

        const scores = { D: 0, T: 0, Tie: 0 };
        let totalMatches = 0;

        for (const o of orders) {
            const stats = o.table[o.key];
            if (stats) {
                const total = stats.D + stats.T + stats.Tie;
                if (total > 0) {
                    scores.D += (stats.D / total) * o.weight;
                    scores.T += (stats.T / total) * o.weight;
                    scores.Tie += (stats.Tie / total) * o.weight;
                    totalMatches += o.weight;
                }
            }
        }

        if (totalMatches === 0) return null;
        return {
            D: scores.D / totalMatches,
            T: scores.T / totalMatches,
            Tie: scores.Tie / totalMatches
        };
    }

    // Pattern match prediction
    predictPattern(input) {
        const seq = input.map(s => this.normalize(s)).filter(Boolean).join('');
        if (seq.length === 0) return null;

        const scores = { D: 0, T: 0, Tie: 0 };
        let total = 0;

        for (let len = Math.min(seq.length, 6); len >= 3; len--) {
            const pat = seq.slice(-len);
            const stats = this.patternMap[pat];
            if (stats) {
                const sum = stats.D + stats.T + stats.Tie;
                if (sum > 0) {
                    const weight = len * len;
                    scores.D += (stats.D / sum) * weight;
                    scores.T += (stats.T / sum) * weight;
                    scores.Tie += (stats.Tie / sum) * weight;
                    total += weight;
                }
            }
        }

        if (total === 0) return null;
        return {
            D: scores.D / total,
            T: scores.T / total,
            Tie: scores.Tie / total
        };
    }

    // Streak analysis - detects long runs and applies break/continue logic
    predictStreak(input) {
        const seq = input.map(s => this.normalize(s)).filter(Boolean);
        if (seq.length === 0) return null;

        const last = seq[seq.length - 1];
        let streak = 1;
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === last) streak++;
            else break;
        }

        const scores = { D: 0.33, T: 0.33, Tie: 0.34 };

        if (streak >= 4) {
            // Long streak - probability of break increases
            scores[last] = 0.25;
            const other = last === 'D' ? 'T' : 'D';
            scores[other] = 0.65;
            scores.Tie = 0.10;
        } else if (streak >= 2) {
            // Short streak - might continue
            scores[last] = 0.55;
            const other = last === 'D' ? 'T' : 'D';
            scores[other] = 0.35;
            scores.Tie = 0.10;
        } else {
            // Alternation pattern check
            if (seq.length >= 4) {
                const last4 = seq.slice(-4);
                if (last4[0] !== last4[1] && last4[1] !== last4[2] && last4[2] !== last4[3]) {
                    // Strong alternation
                    const next = last === 'D' ? 'T' : 'D';
                    scores[next] = 0.75;
                    scores[last] = 0.20;
                    scores.Tie = 0.05;
                }
            }
        }

        return scores;
    }

    // Frequency analysis
    predictFrequency(input) {
        const seq = input.map(s => this.normalize(s)).filter(Boolean);
        if (seq.length === 0) return null;

        const counts = { D: 0, T: 0, Tie: 0 };
        seq.forEach(s => counts[s]++);
        const total = seq.length;

        // Inverse frequency - balance theory (rare = more likely next)
        const balance = {
            D: 1 - (counts.D / total),
            T: 1 - (counts.T / total),
            Tie: 1 - (counts.Tie / total)
        };

        const sum = balance.D + balance.T + balance.Tie;
        return {
            D: balance.D / sum,
            T: balance.T / sum,
            Tie: balance.Tie / sum
        };
    }

    // Main prediction - hybrid combining all methods
    predict(input) {
        if (!input || input.length === 0) {
            return { prediction: 'D', confidence: 0, scores: null };
        }

        const weights = {
            markov: 0.40,
            pattern: 0.30,
            streak: 0.20,
            frequency: 0.10
        };

        const markov = this.predictMarkov(input);
        const pattern = this.predictPattern(input);
        const streak = this.predictStreak(input);
        const freq = this.predictFrequency(input);

        // If only running specific mode
        if (this.mode === 'markov' && markov) return this.finalize(markov);
        if (this.mode === 'pattern' && pattern) return this.finalize(pattern);
        if (this.mode === 'streak' && streak) return this.finalize(streak);

        // Hybrid - combine available signals
        let combined = { D: 0, T: 0, Tie: 0 };
        let totalWeight = 0;

        if (markov) {
            combined.D += markov.D * weights.markov;
            combined.T += markov.T * weights.markov;
            combined.Tie += markov.Tie * weights.markov;
            totalWeight += weights.markov;
        }
        if (pattern) {
            combined.D += pattern.D * weights.pattern;
            combined.T += pattern.T * weights.pattern;
            combined.Tie += pattern.Tie * weights.pattern;
            totalWeight += weights.pattern;
        }
        if (streak) {
            combined.D += streak.D * weights.streak;
            combined.T += streak.T * weights.streak;
            combined.Tie += streak.Tie * weights.streak;
            totalWeight += weights.streak;
        }
        if (freq) {
            combined.D += freq.D * weights.frequency;
            combined.T += freq.T * weights.frequency;
            combined.Tie += freq.Tie * weights.frequency;
            totalWeight += weights.frequency;
        }

        if (totalWeight === 0) {
            // No training data - intelligent default based on input alone
            return this.fallbackPredict(input);
        }

        combined.D /= totalWeight;
        combined.T /= totalWeight;
        combined.Tie /= totalWeight;

        return this.finalize(combined);
    }

    fallbackPredict(input) {
        // Without training, use pure streak/pattern from input
        const streak = this.predictStreak(input) || { D: 0.45, T: 0.45, Tie: 0.10 };
        return this.finalize(streak, true);
    }

    finalize(scores, isFallback = false) {
        // Find winner
        let prediction = 'D';
        let maxScore = scores.D;
        if (scores.T > maxScore) { prediction = 'T'; maxScore = scores.T; }
        if (scores.Tie > maxScore && scores.Tie > 0.4) { prediction = 'Tie'; maxScore = scores.Tie; }

        // Boost confidence based on score gap
        const sorted = [scores.D, scores.T, scores.Tie].sort((a,b)=>b-a);
        const gap = sorted[0] - sorted[1];
        let confidence = (maxScore * 100) + (gap * 50);

        // Training data multiplier - more data = more confidence
        const dataBoost = Math.min(this.trainingData.length / 200, 1) * 15;
        confidence += dataBoost;

        if (isFallback) confidence *= 0.85;

        confidence = Math.max(60, Math.min(99, Math.round(confidence)));

        return {
            prediction,
            confidence,
            scores: {
                D: Math.round(scores.D * 100),
                T: Math.round(scores.T * 100),
                Tie: Math.round(scores.Tie * 100)
            }
        };
    }
}

window.predictor = new DragonTigerPredictor();
