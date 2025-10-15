export const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low Quality (640x360)' },
  { value: 'medium', label: 'Medium Quality (1280x720)' },
  { value: 'high', label: 'High Quality (1920x1080)' }
];

export const OVERLAY_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'logo', label: 'Logo/Image' }
];

export const DEFAULT_OVERLAY = {
  name: '',
  type: 'text',
  content: '',
  position: { x: 50, y: 50 },
  size: { width: 200, height: 50 },
  style: {
    fontSize: 24,
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.5)',
    opacity: 1
  }
};