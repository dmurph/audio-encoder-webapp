console.log('Main thread loaded');

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileNameSpan = document.getElementById('file-name') as HTMLSpanElement;
const convertSection = document.getElementById(
  'convert-section'
) as HTMLDivElement;
const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement;
const progressContainer = document.getElementById(
  'progress-container'
) as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const progressText = document.getElementById(
  'progress-text'
) as HTMLSpanElement;
const resultSection = document.getElementById(
  'result-section'
) as HTMLDivElement;
const audioPreview = document.getElementById(
  'audio-preview'
) as HTMLAudioElement;
const downloadLink = document.getElementById(
  'download-link'
) as HTMLAnchorElement;

const formatSelect = document.getElementById(
  'format-select'
) as HTMLSelectElement;
const mp3OptionsPanel = document.getElementById(
  'mp3-options'
) as HTMLDivElement;
const wavOptionsPanel = document.getElementById(
  'wav-options'
) as HTMLDivElement;
const mp3BitrateSelect = document.getElementById(
  'mp3-bitrate'
) as HTMLSelectElement;
const wavDepthSelect = document.getElementById(
  'wav-depth'
) as HTMLSelectElement;
const mp3ModeSelect = document.getElementById('mp3-mode') as HTMLSelectElement;
const mp3CbrBitrateGroup = document.getElementById(
  'mp3-cbr-bitrate-group'
) as HTMLDivElement;
const mp3VbrQualityGroup = document.getElementById(
  'mp3-vbr-quality-group'
) as HTMLDivElement;
const mp3VbrQualitySelect = document.getElementById(
  'mp3-vbr-quality'
) as HTMLSelectElement;

let selectedFile: File | null = null;

formatSelect.addEventListener('change', () => {
  const format = formatSelect.value;
  if (format === 'mp3') {
    mp3OptionsPanel.style.display = 'block';
    wavOptionsPanel.style.display = 'none';
  } else if (format === 'wav') {
    mp3OptionsPanel.style.display = 'none';
    wavOptionsPanel.style.display = 'block';
  }
});

mp3ModeSelect.addEventListener('change', () => {
  const mode = mp3ModeSelect.value;
  if (mode === 'cbr') {
    mp3CbrBitrateGroup.style.display = 'block';
    mp3VbrQualityGroup.style.display = 'none';
  } else if (mode === 'vbr') {
    mp3CbrBitrateGroup.style.display = 'none';
    mp3VbrQualityGroup.style.display = 'block';
  }
});

// Drag and Drop
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    handleFileSelect(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    handleFileSelect(fileInput.files[0]);
  }
});

function handleFileSelect(file: File) {
  if (file.type !== 'audio/mpeg' && !file.name.endsWith('.mp3')) {
    alert('Please select an MP3 file.');
    return;
  }
  selectedFile = file;
  fileNameSpan.textContent = file.name;
  convertSection.style.display = 'block';
  resultSection.style.display = 'none';
}

convertBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  convertBtn.disabled = true;
  progressContainer.style.display = 'block';
  updateProgress(0);

  const targetFormat = formatSelect.value;
  console.log(`Starting conversion of ${selectedFile.name} to ${targetFormat}`);

  let audioCtx: AudioContext | null = null;
  try {
    // 1. Decode MP3 on Main Thread
    updateProgress(5);
    console.log('Decoding MP3...');
    audioCtx = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const arrayBuffer = await selectedFile.arrayBuffer();

    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    console.log(
      'Decoding complete. Duration:',
      audioBuffer.duration,
      'channels:',
      audioBuffer.numberOfChannels
    );

    updateProgress(20);

    // 2. Extract channel data
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const channels: Float32Array[] = [];
    const transferables: ArrayBuffer[] = [];

    for (let i = 0; i < numChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
      transferables.push(channels[i].buffer as ArrayBuffer);
    }

    // Spawn worker (ES Module)
    const worker = new Worker(new URL('./worker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e) => {
      const { type, data } = e.data;
      if (type === 'progress') {
        const scaledProgress = 20 + data * 0.8;
        updateProgress(scaledProgress);
      } else if (type === 'done') {
        const outputBlob = data as Blob;
        const url = URL.createObjectURL(outputBlob);
        audioPreview.src = url;
        downloadLink.href = url;

        const extension = targetFormat === 'mp3' ? '.mp3' : '.wav';
        downloadLink.download = selectedFile!.name.replace(
          /\.mp3$/i,
          `_converted${extension}`
        );
        downloadLink.textContent = `Download ${targetFormat.toUpperCase()}`;

        resultSection.style.display = 'block';
        convertBtn.disabled = false;
        progressContainer.style.display = 'none';
        worker.terminate();
        if (audioCtx) audioCtx.close();
      } else if (type === 'error') {
        alert('Error during conversion: ' + data);
        convertBtn.disabled = false;
        progressContainer.style.display = 'none';
        worker.terminate();
        if (audioCtx) audioCtx.close();
      }
    };

    // Prepare options
    let options: any = {};
    if (targetFormat === 'mp3') {
      const mode = mp3ModeSelect.value;
      options = {
        mode: mode,
        bitrate: mode === 'cbr' ? parseInt(mp3BitrateSelect.value, 10) : 0,
        vbrQuality:
          mode === 'vbr' ? parseInt(mp3VbrQualitySelect.value, 10) : 0,
      };
    } else if (targetFormat === 'wav') {
      options = {
        bitDepth: parseInt(wavDepthSelect.value, 10),
      };
    }

    // Send PCM data and options to worker
    worker.postMessage(
      {
        type: 'start',
        data: {
          channels: channels,
          sampleRate: sampleRate,
          format: targetFormat,
          options: options,
        },
      },
      transferables
    );
  } catch (err: any) {
    console.error('Failed during conversion process:', err);
    alert('Conversion failed: ' + err.message);
    convertBtn.disabled = false;
    progressContainer.style.display = 'none';
    if (audioCtx) audioCtx.close();
  }
});

function updateProgress(percent: number) {
  progressBar.style.width = `${percent}%`;
  progressText.textContent = `${Math.round(percent)}%`;
}
