export const IMGBB_API_KEY = '74aa3786d3933399da2d9c85162471d7';

export interface ImgBBUploadResponse {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload an image file to ImgBB using the provided API key
 */
export async function uploadToImgBB(file: File): Promise<ImgBBUploadResponse> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Please select a valid image file (PNG, JPG, WEBP, GIF).' };
  }

  // Validate size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: 'Image size must be smaller than 10MB.' };
  }

  try {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      return {
        success: false,
        error: errData?.error?.message || `ImgBB upload failed with status ${response.status}`,
      };
    }

    const data = await response.json();
    if (data.success && data.data?.display_url) {
      return {
        success: true,
        url: data.data.display_url || data.data.url,
      };
    }

    return {
      success: false,
      error: data.error?.message || 'Could not parse image URL from ImgBB response.',
    };
  } catch (err) {
    console.error('ImgBB upload error:', err);
    return {
      success: false,
      error: 'Network error uploading image to ImgBB. Please try again.',
    };
  }
}
