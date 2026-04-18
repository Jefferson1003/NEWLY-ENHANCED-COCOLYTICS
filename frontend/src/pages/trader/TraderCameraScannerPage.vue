<template>
  <section class="scanner-page">
    <header class="scanner-hero scanner-card">
      <div>
        <p class="scanner-eyebrow">Trader Tools</p>
        <h1>Coco Lumber Camera Scanner</h1>
        <p class="scanner-subtitle">
          Measure coconut trunks from live camera input or uploaded images, then estimate volume,
          weight, and possible coco lumber yield.
        </p>
      </div>
      <div class="scanner-hero-badge">
        <span class="hero-badge-label">Mode</span>
        <strong>{{ currentMode === 'realtime' ? 'Real-time Camera' : 'Image Upload' }}</strong>
      </div>
    </header>

    <div class="mode-selection scanner-card">
      <button class="mode-btn" :class="{ active: currentMode === 'realtime' }" @click="switchMode('realtime')">
        Real-time Camera
      </button>
      <button class="mode-btn" :class="{ active: currentMode === 'upload' }" @click="switchMode('upload')">
        Upload Image
      </button>
    </div>

    <section v-show="currentMode === 'realtime'" class="scanner-card scanner-panel">
      <div class="panel-heading">
        <div>
          <h2>Live Detection</h2>
          <p>Use your device camera for real-time diameter, volume, and lumber estimates.</p>
        </div>
      </div>

      <div class="video-wrapper">
        <video ref="videoInput" autoplay playsinline muted></video>
        <canvas ref="canvasOutput" @click="handleCalibrationClick"></canvas>
        <div class="detection-overlay" :class="{ 'overlay-active': detectionOverlayActive }"></div>
        <div v-if="cameraFeedbackVisible" class="camera-feedback">{{ cameraFeedbackMessage }}</div>
      </div>

      <div class="camera-controls">
        <div class="camera-selection" :class="{ 'mobile-hidden': isMobile }">
          <label for="cameraSelect">Select Camera:</label>
          <select id="cameraSelect" v-model="cameraSelectValue">
            <option value="environment">Back Camera</option>
            <option value="user">Front Camera</option>
          </select>
        </div>

        <div class="controls">
          <button class="btn primary" :disabled="!openCvReady || startBtnDisabled" @click="startCamera">
            Start Camera
          </button>
          <button
            class="btn secondary"
            :class="{ active: realTimeDetection }"
            :disabled="toggleDetectBtnDisabled"
            @click="toggleDetection"
          >
            {{ realTimeDetection ? 'Stop Detection' : 'Start Detection' }}
          </button>
          <button class="btn danger" :disabled="stopBtnDisabled" @click="stopCamera">Stop Camera</button>
        </div>
      </div>

      <div v-if="isMobile" class="mobile-instructions scanner-card scanner-subcard">
        <h3>Mobile Instructions</h3>
        <ol>
          <li>Tap Start Camera and allow camera access.</li>
          <li>Point camera at coconut tree trunk.</li>
          <li>Tap Start Detection for real-time measurement.</li>
          <li>Use calibration for better measurement accuracy.</li>
        </ol>
      </div>
    </section>

    <section v-show="currentMode === 'upload'" class="scanner-card scanner-panel">
      <div class="panel-heading">
        <div>
          <h2>Upload Detection</h2>
          <p>Upload a photo, calibrate if needed, and run the same estimate pipeline on a still image.</p>
        </div>
      </div>

      <div
        class="upload-area"
        :class="{ dragover: isDragOver }"
        @click="triggerFileInput"
        @dragover.prevent="isDragOver = true"
        @dragleave="isDragOver = false"
        @drop.prevent="handleDrop"
      >
        <div class="upload-content">
          <span class="upload-icon">[+]</span>
          <h3>Upload Coconut Tree Image</h3>
          <p>Click here or drag and drop your image</p>
          <p class="upload-note">Supports: JPG, PNG, WebP (Max: 5MB)</p>
        </div>
        <input ref="imageInput" type="file" accept="image/*" hidden @change="handleImageUpload" />
      </div>

      <div v-if="uploadedImageSrc" class="upload-preview">
        <img ref="previewImage" :src="uploadedImageSrc" alt="Preview" @load="onPreviewLoaded" />
        <button class="btn danger" @click="removeImage">Remove Image</button>
      </div>

      <div class="upload-controls">
        <button class="btn primary" :disabled="!uploadedImageSrc" @click="analyzeUploadedImage">
          Analyze Image
        </button>
        <button class="btn" :disabled="!uploadedImageSrc" @click="startUploadCalibration">
          Calibrate Upload
        </button>
      </div>
    </section>

    <section class="scanner-card calibration-panel">
      <h3>Calibration</h3>
      <div class="calibration-inputs">
        <label for="refWidth">Reference Width (cm):</label>
        <input id="refWidth" v-model.number="refWidthCm" type="number" step="0.1" min="1" max="100" />
        <button class="btn" @click="startCameraCalibration">Calibrate Camera</button>
      </div>
      <p :style="{ color: calibrationStatusColor }">{{ calibrationStatus }}</p>
    </section>

    <section class="scanner-card results-panel">
      <h3>Measurement Results</h3>
      <div class="result-grid">
        <div class="result-item" :class="{ detecting: detectingPulse }">
          <span class="result-label">Diameter:</span>
          <span>{{ diameterText }}</span>
        </div>
        <div class="result-item" :class="{ detecting: detectingPulse }">
          <span class="result-label">Height:</span>
          <span>{{ heightText }}</span>
        </div>
        <div class="result-item" :class="{ detecting: detectingPulse }">
          <span class="result-label">Volume:</span>
          <span>{{ volumeText }}</span>
        </div>
        <div class="result-item" :class="{ detecting: detectingPulse }">
          <span class="result-label">Weight:</span>
          <span>{{ weightText }}</span>
        </div>
        <div class="result-item highlight" :class="{ detecting: detectingPulse }">
          <span class="result-label">Coco Lumber Pieces:</span>
          <span>{{ lumberText }}</span>
        </div>
      </div>

      <div class="detection-quality">
        <span class="quality-label">Detection Quality:</span>
        <span>{{ qualityText }}</span>
      </div>
      <p class="status-text">{{ statusText }}</p>
    </section>

    <section class="scanner-card scanner-subcard">
      <h3>Detection Information</h3>
      <p>{{ detectionInfoText }}</p>
    </section>
  </section>
</template>

<script>
const LUMBER_VOLUME_CM3 = 2000
const WOOD_DENSITY_G_CM3 = 0.6
const MIN_CONTOUR_AREA = 2500
const DETECTION_INTERVAL = 400
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const SMOOTHING_ALPHA = 0.35

export default {
  name: 'TraderCameraScannerPage',
  data() {
    return {
      stream: null,
      openCvReady: false,
      pixelToCm: 0.1,
      calibrationMode: false,
      isCalibrated: false,
      calibrationPoints: [],
      realTimeDetection: false,
      detectionIntervalId: null,
      currentMode: 'realtime',
      isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),

      cameraSelectValue: 'environment',
      refWidthCm: 10,

      startBtnDisabled: true,
      toggleDetectBtnDisabled: true,
      stopBtnDisabled: true,

      statusText: 'Status: Loading OpenCV...',
      detectionInfoText: 'No tree detected',
      calibrationStatus: 'Not calibrated - Calibrate for accurate measurements',
      calibrationStatusColor: '#9bb1bc',
      cameraFeedbackMessage: '',
      cameraFeedbackVisible: false,
      detectionOverlayActive: false,

      diameterText: '-- cm',
      heightText: '-- cm',
      volumeText: '-- cm3',
      weightText: '-- kg',
      lumberText: '-- pieces',
      qualityText: '--',
      detectingPulse: false,
      smoothedMeasurements: {
        diameter: null,
        height: null,
        volume: null,
        weight: null,
        lumber: null,
      },

      isDragOver: false,
      uploadedImageSrc: '',
      uploadedImageNaturalWidth: 0,
      uploadedImageNaturalHeight: 0,
      uploadCalibrationClickHandler: null,
    }
  },
  mounted() {
    this.pixelToCm = this.isMobile ? 0.05 : 0.1
    this.startBtnDisabled = true
    this.toggleDetectBtnDisabled = true
    this.stopBtnDisabled = true
    this.ensureOpenCv()

    window.addEventListener('resize', this.handleResize)
    window.addEventListener('orientationchange', this.handleResize)
  },
  beforeUnmount() {
    this.cleanupScanner()
  },
  methods: {
    async ensureOpenCv() {
      try {
        if (window.cv && typeof window.cv.imread === 'function') {
          this.onOpenCvReady()
          return
        }

        if (!document.getElementById('opencv-js-script')) {
          const script = document.createElement('script')
          script.id = 'opencv-js-script'
          script.async = true
          script.src = 'https://docs.opencv.org/master/opencv.js'
          document.head.appendChild(script)
        }

        await this.waitForOpenCv(30000)
        this.onOpenCvReady()
      } catch (error) {
        console.error('OpenCV load error:', error)
        this.statusText = 'Status: Failed to load OpenCV'
        this.updateCameraFeedback('OpenCV failed to load')
      }
    },

    waitForOpenCv(timeoutMs) {
      return new Promise((resolve, reject) => {
        const start = Date.now()
        const timer = setInterval(() => {
          if (window.cv && typeof window.cv.imread === 'function' && window.cv.Mat) {
            clearInterval(timer)
            resolve()
            return
          }

          if (Date.now() - start > timeoutMs) {
            clearInterval(timer)
            reject(new Error('OpenCV initialization timeout'))
          }
        }, 120)
      })
    },

    onOpenCvReady() {
      this.openCvReady = true
      this.startBtnDisabled = false
      this.statusText = 'Status: Ready - Select mode to start'
      this.updateCameraFeedback('OpenCV loaded successfully')
    },

    switchMode(mode) {
      this.currentMode = mode

      if (mode === 'upload' && this.stream) {
        this.stopCamera()
      }

      this.statusText = `Status: ${mode === 'realtime' ? 'Real-time mode' : 'Upload mode'} - Ready to start`
      this.detectionInfoText = mode === 'realtime' ? 'No tree detected' : 'No image uploaded'
      this.clearResults()
    },

    triggerFileInput() {
      const input = this.$refs.imageInput
      if (input) {
        input.click()
      }
    },

    handleDrop(event) {
      this.isDragOver = false
      const [file] = event.dataTransfer.files || []
      if (file) {
        this.handleImageFile(file)
      }
    },

    handleImageUpload(event) {
      const [file] = event.target.files || []
      if (file) {
        this.handleImageFile(file)
      }
    },

    handleImageFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPG, PNG, WebP)')
        return
      }

      if (file.size > MAX_IMAGE_SIZE) {
        alert('Image size too large. Please upload image smaller than 5MB.')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        this.uploadedImageSrc = e.target.result
        this.statusText = 'Status: Image uploaded - Click Analyze Image'
        this.detectionInfoText = 'Image ready for analysis'
      }
      reader.readAsDataURL(file)
    },

    onPreviewLoaded() {
      const previewImage = this.$refs.previewImage
      if (!previewImage) {
        return
      }

      this.uploadedImageNaturalWidth = previewImage.naturalWidth || 0
      this.uploadedImageNaturalHeight = previewImage.naturalHeight || 0
    },

    removeImage() {
      this.uploadedImageSrc = ''
      this.uploadedImageNaturalWidth = 0
      this.uploadedImageNaturalHeight = 0

      if (this.$refs.imageInput) {
        this.$refs.imageInput.value = ''
      }

      this.removeUploadCalibrationHandler()
      this.statusText = 'Status: Upload mode - No image selected'
      this.detectionInfoText = 'No image uploaded'
      this.clearResults()
    },

    analyzeUploadedImage() {
      if (!this.uploadedImageSrc) {
        alert('Please upload an image first!')
        return
      }

      if (!this.openCvReady) {
        alert('OpenCV is still loading. Please wait...')
        return
      }

      const previewImage = this.$refs.previewImage
      if (!previewImage || !this.uploadedImageNaturalWidth || !this.uploadedImageNaturalHeight) {
        this.statusText = 'Status: Image not ready yet'
        return
      }

      this.statusText = 'Status: Analyzing image...'
      this.detectionInfoText = 'Processing image for tree detection'

      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')

      tempCanvas.width = this.uploadedImageNaturalWidth
      tempCanvas.height = this.uploadedImageNaturalHeight
      tempCtx.drawImage(previewImage, 0, 0, tempCanvas.width, tempCanvas.height)

      this.processImageWithOpenCv(tempCanvas)
    },

    processImageWithOpenCv(canvas) {
      try {
        const src = window.cv.imread(canvas)
        const results = this.enhancedTreeDetection(src)

        if (results.detected) {
          this.updateEnhancedResults(
            results.diameter,
            results.height,
            results.volume,
            results.weight,
            results.lumber
          )

          this.drawImageDetection(canvas, results.rect)
          this.qualityText = results.quality
          this.detectionInfoText = this.isCalibrated
            ? `Tree detected: ${results.contourArea.toFixed(0)} pixels`
            : `Tree detected: ${results.contourArea.toFixed(0)} pixels (estimated - calibrate for accuracy)`
          this.statusText = 'Status: Analysis complete'
        } else {
          this.showNoDetection()
          this.detectionInfoText = 'No tree detected in image'
          this.statusText = 'Status: Analysis failed - No tree found'
        }

        src.delete()
      } catch (error) {
        console.error('Image analysis error:', error)
        this.showNoDetection()
        this.detectionInfoText = 'Analysis error - Try another image'
        this.statusText = 'Status: Analysis error'
      }
    },

    drawImageDetection(canvas, rect) {
      const ctx = canvas.getContext('2d')
      ctx.strokeStyle = '#e74c3c'
      ctx.lineWidth = 4
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

      ctx.fillStyle = '#e74c3c'
      ctx.font = 'bold 16px Arial'
      ctx.fillText(`D: ${(rect.width * this.pixelToCm).toFixed(1)}cm`, rect.x, Math.max(20, rect.y - 10))
      ctx.fillText(`H: ${(rect.height * this.pixelToCm).toFixed(1)}cm`, rect.x, rect.y + rect.height + 25)

      this.uploadedImageSrc = canvas.toDataURL('image/jpeg', 0.92)
    },

    startUploadCalibration() {
      if (!this.uploadedImageSrc) {
        alert('Please upload an image first!')
        return
      }

      const previewImage = this.$refs.previewImage
      if (!previewImage) {
        return
      }

      this.removeUploadCalibrationHandler()
      this.calibrationMode = true
      this.calibrationPoints = []
      this.calibrationStatus = 'Click two points on a known object in the image...'
      this.calibrationStatusColor = '#f59e0b'
      this.detectionInfoText = 'Calibration mode - Click two points on image'

      this.uploadCalibrationClickHandler = (event) => {
        if (!this.calibrationMode) {
          return
        }

        const rect = previewImage.getBoundingClientRect()
        const scaleX = this.uploadedImageNaturalWidth / rect.width
        const scaleY = this.uploadedImageNaturalHeight / rect.height

        const x = (event.clientX - rect.left) * scaleX
        const y = (event.clientY - rect.top) * scaleY

        this.calibrationPoints.push({ x, y })

        if (this.calibrationPoints.length === 1) {
          this.calibrationStatus = 'Now click the second point...'
        }

        if (this.calibrationPoints.length === 2) {
          const pixelDistance = Math.hypot(
            this.calibrationPoints[1].x - this.calibrationPoints[0].x,
            this.calibrationPoints[1].y - this.calibrationPoints[0].y
          )

          if (this.refWidthCm > 0 && pixelDistance > 10) {
            this.pixelToCm = this.refWidthCm / pixelDistance
            this.isCalibrated = true
            this.calibrationMode = false
            this.calibrationStatus = `Calibrated: 1px = ${this.pixelToCm.toFixed(4)}cm`
            this.calibrationStatusColor = '#10b981'
            this.removeUploadCalibrationHandler()

            setTimeout(() => {
              this.analyzeUploadedImage()
            }, 350)
          } else {
            this.calibrationStatus = 'Points too close - try again'
            this.calibrationStatusColor = '#ef4444'
            this.calibrationPoints = []
          }
        }
      }

      previewImage.addEventListener('click', this.uploadCalibrationClickHandler)
    },

    removeUploadCalibrationHandler() {
      const previewImage = this.$refs.previewImage
      if (previewImage && this.uploadCalibrationClickHandler) {
        previewImage.removeEventListener('click', this.uploadCalibrationClickHandler)
      }

      this.uploadCalibrationClickHandler = null
    },

    async startCamera() {
      try {
        if (!this.openCvReady) {
          alert('Please wait for OpenCV to load completely...')
          return
        }

        this.updateCameraFeedback('Starting camera...')

        if (this.stream) {
          this.stopCamera()
        }

        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24 },
            facingMode: this.cameraSelectValue,
          },
          audio: false,
        }

        this.stream = await navigator.mediaDevices.getUserMedia(constraints)

        const videoInput = this.$refs.videoInput
        const canvasOutput = this.$refs.canvasOutput
        videoInput.srcObject = this.stream

        await new Promise((resolve) => {
          videoInput.onloadedmetadata = () => resolve()
        })

        await videoInput.play()

        canvasOutput.width = videoInput.videoWidth
        canvasOutput.height = videoInput.videoHeight

        this.toggleDetectBtnDisabled = false
        this.stopBtnDisabled = false
        this.startBtnDisabled = true
        this.statusText = 'Status: Camera active - Click Start Detection'
        this.updateCameraFeedback(`Camera active: ${videoInput.videoWidth}x${videoInput.videoHeight}`)
      } catch (error) {
        console.error('Camera access error:', error)
        this.handleCameraError(error)
      }
    },

    handleCameraError(error) {
      let errorMessage = 'Camera error: '

      switch (error.name) {
        case 'NotAllowedError':
          errorMessage += 'Please allow camera access in your browser settings.'
          break
        case 'NotFoundError':
          errorMessage += 'No camera found on this device.'
          break
        case 'NotSupportedError':
          errorMessage += 'Camera not supported by your browser.'
          break
        case 'NotReadableError':
          errorMessage += 'Camera is being used by another application.'
          break
        case 'OverconstrainedError':
          errorMessage += 'Requested camera settings are not supported. Trying fallback...'
          this.tryAlternativeConstraints()
          return
        default:
          errorMessage += 'Unknown error occurred.'
      }

      alert(errorMessage)
      this.statusText = `Status: ${errorMessage}`
      this.updateCameraFeedback(errorMessage)
    },

    async tryAlternativeConstraints() {
      try {
        this.updateCameraFeedback('Trying alternative camera settings...')

        const alternativeConstraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 15 },
          },
          audio: false,
        }

        this.stream = await navigator.mediaDevices.getUserMedia(alternativeConstraints)

        const videoInput = this.$refs.videoInput
        const canvasOutput = this.$refs.canvasOutput
        videoInput.srcObject = this.stream

        videoInput.onloadedmetadata = async () => {
          await videoInput.play()
          canvasOutput.width = videoInput.videoWidth
          canvasOutput.height = videoInput.videoHeight

          this.toggleDetectBtnDisabled = false
          this.stopBtnDisabled = false
          this.startBtnDisabled = true
          this.statusText = 'Status: Camera active (fallback mode)'
          this.updateCameraFeedback('Camera started with fallback settings')
        }
      } catch (fallbackError) {
        console.error('Fallback camera also failed:', fallbackError)
        alert('Cannot access camera with any settings. Please check permissions.')
      }
    },

    toggleDetection() {
      if (!this.stream) {
        alert('Please start camera first!')
        return
      }

      if (!this.realTimeDetection) {
        this.realTimeDetection = true
        this.statusText = 'Status: Real-time detection active'
        this.detectionIntervalId = setInterval(this.processFrame, DETECTION_INTERVAL)
        this.updateCameraFeedback('Detection active - Point camera at tree')
      } else {
        this.realTimeDetection = false
        this.statusText = 'Status: Detection paused'
        this.detectionOverlayActive = false

        if (this.detectionIntervalId) {
          clearInterval(this.detectionIntervalId)
          this.detectionIntervalId = null
        }

        this.updateCameraFeedback('Detection paused')
      }
    },

    startCameraCalibration() {
      if (!this.stream) {
        alert('Please start camera first!')
        return
      }

      if (!this.refWidthCm || this.refWidthCm <= 0) {
        alert('Please enter a valid reference width in centimeters.')
        return
      }

      this.calibrationMode = true
      this.calibrationPoints = []
      this.calibrationStatus = 'Tap two points on a known object...'
      this.calibrationStatusColor = '#f59e0b'
      this.updateCameraFeedback('Calibration mode active')
    },

    handleCalibrationClick(event) {
      if (!this.calibrationMode || this.currentMode !== 'realtime') {
        return
      }

      const canvasOutput = this.$refs.canvasOutput
      const rect = canvasOutput.getBoundingClientRect()
      const scaleX = canvasOutput.width / rect.width
      const scaleY = canvasOutput.height / rect.height

      const x = (event.clientX - rect.left) * scaleX
      const y = (event.clientY - rect.top) * scaleY

      this.calibrationPoints.push({ x, y })

      const ctx = canvasOutput.getContext('2d')
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, 2 * Math.PI)
      ctx.fillStyle = this.calibrationPoints.length === 1 ? '#3b82f6' : '#ef4444'
      ctx.fill()

      if (this.calibrationPoints.length === 1) {
        this.calibrationStatus = 'Now tap the second point...'
        this.updateCameraFeedback('First point captured')
      }

      if (this.calibrationPoints.length === 2) {
        const pixelDistance = Math.hypot(
          this.calibrationPoints[1].x - this.calibrationPoints[0].x,
          this.calibrationPoints[1].y - this.calibrationPoints[0].y
        )

        if (this.refWidthCm > 0 && pixelDistance > 10) {
          this.pixelToCm = this.refWidthCm / pixelDistance
          this.isCalibrated = true
          this.calibrationMode = false
          this.calibrationStatus = `Calibrated: 1px = ${this.pixelToCm.toFixed(4)}cm`
          this.calibrationStatusColor = '#10b981'
          this.updateCameraFeedback(`Calibration complete: ${this.pixelToCm.toFixed(4)}cm/px`)

          setTimeout(() => {
            if (this.realTimeDetection) {
              this.processFrame()
            }
          }, 400)
        } else {
          this.calibrationStatus = 'Points too close - try again'
          this.calibrationStatusColor = '#ef4444'
          this.calibrationPoints = []
        }
      }
    },

    processFrame() {
      const videoInput = this.$refs.videoInput
      const canvasOutput = this.$refs.canvasOutput

      if (!this.stream || !videoInput || !videoInput.videoWidth || !canvasOutput || !window.cv) {
        return
      }

      try {
        const ctx = canvasOutput.getContext('2d')

        if (canvasOutput.width !== videoInput.videoWidth || canvasOutput.height !== videoInput.videoHeight) {
          canvasOutput.width = videoInput.videoWidth
          canvasOutput.height = videoInput.videoHeight
        }

        ctx.drawImage(videoInput, 0, 0, canvasOutput.width, canvasOutput.height)

        const src = window.cv.imread(canvasOutput)
        const results = this.enhancedTreeDetection(src)

        if (results.detected) {
          const smoothedDiameter = this.getSmoothedMeasurement('diameter', results.diameter)
          const smoothedHeight = this.getSmoothedMeasurement('height', results.height)
          const smoothedVolume = this.getSmoothedMeasurement('volume', results.volume)
          const smoothedWeight = this.getSmoothedMeasurement('weight', results.weight)
          const smoothedLumber = this.getSmoothedMeasurement('lumber', results.lumber)

          this.updateEnhancedResults(
            smoothedDiameter,
            smoothedHeight,
            smoothedVolume,
            smoothedWeight,
            smoothedLumber
          )

          this.drawDetectionOverlay(results.rect)
          this.qualityText = results.quality
          this.detectionInfoText = this.isCalibrated
            ? `Tree detected: ${results.contourArea.toFixed(0)} pixels`
            : `Tree detected: ${results.contourArea.toFixed(0)} pixels (estimated - calibrate for accuracy)`
        } else {
          this.showNoDetection()
          this.detectionInfoText = 'No tree detected - adjust camera'
        }

        src.delete()
      } catch (error) {
        console.error('Frame processing error:', error)
        this.showNoDetection()
        this.detectionInfoText = 'Processing error'
      }
    },

    drawDetectionOverlay(rect) {
      this.detectionOverlayActive = true

      const canvasOutput = this.$refs.canvasOutput
      const ctx = canvasOutput.getContext('2d')
      ctx.strokeStyle = '#e74c3c'
      ctx.lineWidth = 3
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

      ctx.fillStyle = '#e74c3c'
      ctx.font = '14px Arial'
      ctx.fillText(`D: ${(rect.width * this.pixelToCm).toFixed(1)}cm`, rect.x, Math.max(16, rect.y - 4))
      ctx.fillText(`H: ${(rect.height * this.pixelToCm).toFixed(1)}cm`, rect.x, rect.y + rect.height + 18)
    },

    stopCamera() {
      if (this.realTimeDetection) {
        this.realTimeDetection = false
      }

      if (this.detectionIntervalId) {
        clearInterval(this.detectionIntervalId)
        this.detectionIntervalId = null
      }

      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop())
        this.stream = null
      }

      const videoInput = this.$refs.videoInput
      if (videoInput) {
        videoInput.srcObject = null
      }

      this.toggleDetectBtnDisabled = true
      this.stopBtnDisabled = true
      this.startBtnDisabled = !this.openCvReady
      this.statusText = 'Status: Camera stopped'
      this.detectionOverlayActive = false

      this.showNoDetection()
      this.updateCameraFeedback('Camera stopped')
    },

    enhancedTreeDetection(src) {
      const cv = window.cv

      const rgb = new cv.Mat()
      const hsv = new cv.Mat()
      const blurred = new cv.Mat()
      const mask = new cv.Mat()

      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
      cv.GaussianBlur(rgb, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT)
      cv.cvtColor(blurred, hsv, cv.COLOR_RGB2HSV)

      const lowBrown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [5, 40, 25, 0])
      const highBrown1 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [35, 255, 220, 255])
      const lowBrown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 25, 20, 0])
      const highBrown2 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [14, 255, 255, 255])
      const lowBrown3 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [150, 20, 20, 0])
      const highBrown3 = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [179, 255, 210, 255])

      const mask1 = new cv.Mat()
      const mask2 = new cv.Mat()
      const mask3 = new cv.Mat()
      const maskCombined12 = new cv.Mat()

      cv.inRange(hsv, lowBrown1, highBrown1, mask1)
      cv.inRange(hsv, lowBrown2, highBrown2, mask2)
      cv.inRange(hsv, lowBrown3, highBrown3, mask3)
      cv.bitwise_or(mask1, mask2, maskCombined12)
      cv.bitwise_or(maskCombined12, mask3, mask)

      const baseKernel = Math.max(3, Math.round(Math.min(src.rows, src.cols) / 180) | 1)
      const closeKernel = Math.min(15, Math.max(5, baseKernel * 3))
      const kernelOpen = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(baseKernel, baseKernel))
      const kernelClose = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(closeKernel, closeKernel))

      cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernelOpen)
      cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernelClose)

      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

      let result = {
        detected: false,
        diameter: 0,
        height: 0,
        volume: 0,
        weight: 0,
        lumber: 0,
        quality: 'Low',
        contourArea: 0,
        rect: null,
      }

      if (contours.size() > 0) {
        let bestScore = 0
        let bestContour = null
        let bestArea = 0

        for (let i = 0; i < contours.size(); i += 1) {
          const contour = contours.get(i)
          const area = cv.contourArea(contour)
          if (area < MIN_CONTOUR_AREA) {
            continue
          }

          const rotated = cv.minAreaRect(contour)
          const w = Math.max(rotated.size.width, 1)
          const h = Math.max(rotated.size.height, 1)
          const aspectRatio = Math.max(w, h) / Math.max(1, Math.min(w, h))

          const hull = new cv.Mat()
          cv.convexHull(contour, hull, false, true)
          const hullArea = Math.max(cv.contourArea(hull), 1)
          hull.delete()
          const solidity = Math.min(1, area / hullArea)

          const aspectBoost = aspectRatio >= 1.2 ? 1 : 0.75
          const score = area * (0.6 + 0.4 * solidity) * aspectBoost

          if (score > bestScore) {
            bestScore = score
            bestContour = contour
            bestArea = area
          }
        }

        if (bestContour) {
          const rect = cv.boundingRect(bestContour)
          const rotated = cv.minAreaRect(bestContour)
          const longPx = Math.max(rotated.size.width, rotated.size.height)
          const shortPx = Math.min(rotated.size.width, rotated.size.height)

          const diameterPx = shortPx * 0.7 + rect.width * 0.3
          const heightPx = longPx * 0.7 + rect.height * 0.3

          const diameterCm = diameterPx * this.pixelToCm
          const heightCm = heightPx * this.pixelToCm
          const radiusCm = diameterCm / 2
          const volumeCm3 = Math.PI * Math.pow(radiusCm, 2) * heightCm * 0.8
          const weightKg = (volumeCm3 * WOOD_DENSITY_G_CM3) / 1000
          const numLumber = Math.max(0, (volumeCm3 / LUMBER_VOLUME_CM3) * 0.7)

          const hull = new cv.Mat()
          cv.convexHull(bestContour, hull, false, true)
          const hullArea = Math.max(cv.contourArea(hull), 1)
          hull.delete()
          const solidity = Math.min(1, bestArea / hullArea)
          const aspectRatio = Math.max(longPx / Math.max(1, shortPx), 1)

          const areaScore = Math.min(1, bestArea / 15000)
          const solidityScore = Math.min(1, solidity / 0.9)
          const aspectScore = Math.min(1, Math.max(0, (aspectRatio - 1.1) / 3))
          const qualityScore = areaScore * 0.45 + solidityScore * 0.35 + aspectScore * 0.2
          const quality = qualityScore >= 0.78 ? 'High' : qualityScore >= 0.5 ? 'Medium' : 'Low'

          result = {
            detected: true,
            diameter: diameterCm,
            height: heightCm,
            volume: volumeCm3,
            weight: weightKg,
            lumber: numLumber,
            quality,
            contourArea: bestArea,
            rect,
          }
        }
      }

      ;[
        rgb,
        hsv,
        blurred,
        mask,
        mask1,
        mask2,
        mask3,
        maskCombined12,
        contours,
        hierarchy,
        lowBrown1,
        highBrown1,
        lowBrown2,
        highBrown2,
        lowBrown3,
        highBrown3,
        kernelOpen,
        kernelClose,
      ].forEach((mat) => {
        if (mat && typeof mat.isDeleted === 'function' && !mat.isDeleted()) {
          mat.delete()
        }
      })

      return result
    },

    updateEnhancedResults(diameter, height, volume, weight, lumber) {
      this.diameterText = `${diameter.toFixed(1)} cm`
      this.heightText = `${height.toFixed(1)} cm`
      this.volumeText = `${volume.toFixed(0)} cm3`
      this.weightText = `${weight.toFixed(1)} kg`
      this.lumberText = `${Math.round(lumber * 10) / 10} pieces`

      this.detectingPulse = true
      setTimeout(() => {
        this.detectingPulse = false
      }, 700)
    },

    showNoDetection() {
      this.diameterText = '-- cm'
      this.heightText = '-- cm'
      this.volumeText = '-- cm3'
      this.weightText = '-- kg'
      this.lumberText = '-- pieces'
      this.qualityText = '--'
      this.detectionOverlayActive = false
      this.resetSmoothedMeasurements()
    },

    clearResults() {
      this.showNoDetection()
    },

    getSmoothedMeasurement(key, value) {
      const previous = this.smoothedMeasurements[key]
      if (previous === null || Number.isNaN(previous)) {
        this.smoothedMeasurements[key] = value
        return value
      }

      const smoothed = previous * (1 - SMOOTHING_ALPHA) + value * SMOOTHING_ALPHA
      this.smoothedMeasurements[key] = smoothed
      return smoothed
    },

    resetSmoothedMeasurements() {
      this.smoothedMeasurements = {
        diameter: null,
        height: null,
        volume: null,
        weight: null,
        lumber: null,
      }
    },

    updateCameraFeedback(message) {
      this.cameraFeedbackMessage = message
      this.cameraFeedbackVisible = true

      setTimeout(() => {
        if (!this.calibrationMode) {
          this.cameraFeedbackVisible = false
        }
      }, 2800)
    },

    handleResize() {
      if (!this.realTimeDetection) {
        return
      }

      if (this.detectionIntervalId) {
        clearInterval(this.detectionIntervalId)
      }

      setTimeout(() => {
        if (this.realTimeDetection) {
          this.detectionIntervalId = setInterval(this.processFrame, DETECTION_INTERVAL)
        }
      }, 700)
    },

    cleanupScanner() {
      this.removeUploadCalibrationHandler()

      if (this.detectionIntervalId) {
        clearInterval(this.detectionIntervalId)
        this.detectionIntervalId = null
      }

      this.stopCamera()
      window.removeEventListener('resize', this.handleResize)
      window.removeEventListener('orientationchange', this.handleResize)
    },
  },
}
</script>

<style scoped>
.scanner-page {
  display: grid;
  gap: 14px;
}

.scanner-card {
  background: linear-gradient(160deg, rgba(8, 34, 46, 0.9), rgba(10, 48, 62, 0.95));
  border: 1px solid rgba(143, 244, 200, 0.18);
  border-radius: 16px;
  box-shadow: 0 16px 35px rgba(0, 0, 0, 0.28);
}

.scanner-hero {
  padding: 18px;
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.scanner-eyebrow {
  margin: 0 0 8px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8ff4c8;
}

h1 {
  margin: 0;
  color: #ecfff6;
  font-size: clamp(1.25rem, 2.3vw, 1.7rem);
}

.scanner-subtitle {
  margin: 8px 0 0;
  max-width: 760px;
  color: #c8f6e4;
  line-height: 1.5;
  font-size: 0.92rem;
}

.scanner-hero-badge {
  min-width: 160px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(14, 61, 79, 0.9);
  border: 1px solid rgba(143, 244, 200, 0.22);
  color: #f3fff9;
}

.hero-badge-label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #bff9e3;
}

.mode-selection {
  padding: 10px;
  display: flex;
  gap: 10px;
}

.mode-btn {
  flex: 1;
  padding: 12px;
  border-radius: 11px;
  border: 1px solid rgba(143, 244, 200, 0.22);
  background: rgba(8, 29, 39, 0.86);
  color: #dffff2;
  font-weight: 700;
  cursor: pointer;
}

.mode-btn:hover {
  background: rgba(16, 62, 79, 0.86);
}

.mode-btn.active {
  background: linear-gradient(135deg, #1d8f78 0%, #14b190 100%);
  color: #f5fffb;
}

.scanner-panel {
  padding: 16px;
}

.scanner-subcard {
  padding: 14px;
}

.panel-heading h2,
.panel-heading p,
.results-panel h3,
.scanner-subcard h3,
.scanner-subcard p,
.calibration-panel h3 {
  margin: 0;
}

.panel-heading p,
.scanner-subcard p,
.status-text {
  margin-top: 6px;
  color: #c9f7e5;
}

.video-wrapper {
  position: relative;
  width: 100%;
  height: min(56vw, 380px);
  border: 1px solid rgba(143, 244, 200, 0.3);
  border-radius: 14px;
  overflow: hidden;
  background: #051922;
  margin-top: 12px;
}

video,
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

video {
  object-fit: cover;
  z-index: 1;
}

canvas {
  z-index: 2;
}

.detection-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid transparent;
  z-index: 3;
}

.overlay-active {
  border-color: #f97316;
  box-shadow: inset 0 0 28px rgba(249, 115, 22, 0.22);
}

.camera-feedback {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 4;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(7, 27, 37, 0.84);
  color: #d8fff0;
  font-size: 0.8rem;
}

.camera-controls {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.camera-selection {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #d6ffef;
  font-size: 0.85rem;
}

.camera-selection select {
  background: rgba(7, 28, 38, 0.9);
  border: 1px solid rgba(143, 244, 200, 0.28);
  color: #edfff7;
  border-radius: 8px;
  padding: 6px 8px;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  border: 1px solid rgba(143, 244, 200, 0.32);
  border-radius: 10px;
  background: rgba(10, 41, 53, 0.95);
  color: #e8fff5;
  padding: 9px 12px;
  font-weight: 700;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  background: linear-gradient(135deg, #178267 0%, #13a983 100%);
  border-color: transparent;
}

.btn.secondary.active {
  background: linear-gradient(135deg, #0e7490 0%, #0284c7 100%);
  border-color: transparent;
}

.btn.danger {
  background: linear-gradient(135deg, #b91c1c 0%, #dc2626 100%);
  border-color: transparent;
}

.mobile-instructions {
  margin-top: 12px;
}

.mobile-instructions h3 {
  margin: 0 0 8px;
  color: #ebfff6;
}

.mobile-instructions ol {
  margin: 0;
  padding-left: 1.1rem;
  color: #d2fbe9;
}

.upload-area {
  border: 2px dashed rgba(143, 244, 200, 0.34);
  border-radius: 14px;
  padding: 18px;
  text-align: center;
  color: #d5ffef;
  cursor: pointer;
  margin-top: 12px;
  background: rgba(6, 24, 32, 0.56);
}

.upload-area.dragover {
  border-color: #19c799;
  background: rgba(24, 128, 102, 0.2);
}

.upload-content h3 {
  margin: 8px 0 6px;
}

.upload-note {
  font-size: 0.8rem;
  color: #a8e8cf;
}

.upload-preview {
  margin-top: 14px;
  display: grid;
  gap: 10px;
}

.upload-preview img {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  border-radius: 12px;
  border: 1px solid rgba(143, 244, 200, 0.3);
  background: #04121a;
}

.upload-controls {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.calibration-panel {
  padding: 14px;
}

.calibration-inputs {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.calibration-inputs label {
  color: #d5ffed;
  font-size: 0.86rem;
}

.calibration-inputs input {
  width: 130px;
  border-radius: 8px;
  border: 1px solid rgba(143, 244, 200, 0.28);
  background: rgba(7, 28, 38, 0.88);
  color: #edfff8;
  padding: 8px;
}

.results-panel {
  padding: 14px;
}

.result-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}

.result-item {
  border: 1px solid rgba(143, 244, 200, 0.24);
  border-radius: 10px;
  padding: 10px;
  display: grid;
  gap: 4px;
  color: #e4fff4;
  background: rgba(7, 29, 39, 0.8);
}

.result-item.highlight {
  border-color: rgba(251, 146, 60, 0.6);
  background: rgba(124, 45, 18, 0.35);
}

.result-item.detecting {
  animation: pulse 0.7s ease;
}

.result-label {
  font-size: 0.78rem;
  color: #a8e9d1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detection-quality {
  margin-top: 10px;
  color: #d6fff0;
}

.quality-label {
  color: #a8e8cf;
  margin-right: 6px;
}

.status-text {
  margin-top: 8px;
  margin-bottom: 0;
}

@keyframes pulse {
  0% { transform: scale(1); }
  45% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@media (max-width: 860px) {
  .scanner-hero {
    flex-direction: column;
  }

  .scanner-hero-badge {
    width: 100%;
  }

  .mobile-hidden {
    display: none;
  }

  .video-wrapper {
    height: 60vw;
    min-height: 230px;
  }
}
</style>
