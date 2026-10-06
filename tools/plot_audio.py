import numpy as np, sys, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from scipy.io import wavfile; import scipy.signal as ss
sr, x = wavfile.read(sys.argv[1]); x = x.astype(np.float64)
m = x.mean(axis=1)
fig, ax = plt.subplots(2, 1, figsize=(22, 9), sharex=True)
hop = sr // 10
rms = np.array([np.sqrt(np.mean(m[i:i+hop]**2)) for i in range(0, len(m)-hop, hop)])
pk = np.array([np.max(np.abs(x[i:i+hop])) for i in range(0, len(m)-hop, hop)])
tt = np.arange(len(rms)) / 10
ax[0].plot(tt, 20*np.log10(rms+1e-9), lw=0.7, label='rms'); ax[0].plot(tt, 20*np.log10(pk+1e-9), lw=0.5, alpha=.6, label='peak'); ax[0].set_ylim(-60, 2); ax[0].legend(); ax[0].grid(alpha=.3)
f, t, S = ss.spectrogram(m[::2], fs=sr/2, nperseg=2048, noverlap=1024)
ax[1].pcolormesh(t, f, 10*np.log10(S+1e-12), shading='auto', vmin=-130, vmax=-40, cmap='magma'); ax[1].set_yscale('symlog', linthresh=200); ax[1].set_ylim(20, 12000)
for b in [15,27,43.2,60,69.5,81.5,98,111,137,145,156.2,172,201]:
    for a in ax: a.axvline(b, color='c', lw=0.6)
ax[1].set_xticks(range(0, 223, 5))
plt.tight_layout(); plt.savefig(sys.argv[2], dpi=70)
