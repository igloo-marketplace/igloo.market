import { useState, useEffect, useRef } from 'react';
import styles from './NFTImage.module.css';

interface Props {
    src?: string;
    alt: string;
    className?: string;
    fit?: 'cover' | 'contain';
    autoPlay?: boolean; 
}

const PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwMCIgaGVpZ2h0PSI0MDAiIGZpbGw9IiMxMTE4MjciLz48cGF0aCBkPSJNMTc1IDE1MEgxNjBWMjUwSDI0MFYyMzVIMTc1VjE1MFoiIGZpbGw9IiM0QjU1NjMiLz48Y2lyY2xlIGN4PSIyMjAiIGN5PSIxNzAiIHI9IjI1IiBmaWxsPSIjNEI1NTYzIi8+PC9zdmc+';

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

function isVideo(url: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => lowerUrl.includes(ext));
}

export function NFTImage({ src, alt, className, fit = 'cover', autoPlay = false }: Props) {
    const [imageUrl, setImageUrl] = useState<string>(PLACEHOLDER);
    const [loading, setLoading] = useState(true);
    const [_error, setError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const resolvedUrl = src ? resolveImageUrl(src) : PLACEHOLDER;
    const isVideoFile = isVideo(resolvedUrl);

    useEffect(() => {
        if (!src) {
            setImageUrl(PLACEHOLDER);
            setLoading(false);
            return;
        }

        const resolved = resolveImageUrl(src);
        setImageUrl(resolved);

        setLoading(true);
        setError(false);

        // 비디오는 onLoadedData에서 처리
        if (isVideo(resolved)) {
            return;
        }

        // 이미지만 preload
        const img = new Image();
        img.onload = () => {
            setLoading(false);
        };
        img.onerror = () => {
            setLoading(false);
            setError(true);
            setImageUrl(PLACEHOLDER);
        };
        img.src = resolved;
    }, [src]);

    const handleMouseEnter = () => {
        if (videoRef.current && !autoPlay) {
            videoRef.current.play().catch(() => {});
        }
    };

    const handleMouseLeave = () => {
        if (videoRef.current && !autoPlay) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    };

    return (
        <div
            className={`${styles.wrapper} ${className || ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {loading && <div className={styles.skeleton} />}

            {isVideoFile ? (
                <video
                    ref={videoRef}
                    src={imageUrl}
                    className={`${styles.image} ${fit === 'contain' ? styles.contain : ''} ${loading ? styles.hidden : ''}`}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    autoPlay={autoPlay}
                    onLoadedData={(e) => {
                        setLoading(false);
                        // 첫 프레임 표시를 위해 살짝 이동
                        if (!autoPlay) {
                            e.currentTarget.currentTime = 0.01;
                        }
                    }}
                    onError={() => {
                        setLoading(false);
                        setError(true);
                        setImageUrl(PLACEHOLDER);
                    }}
                />
            ) : (
                <img
                    src={imageUrl}
                    alt={alt}
                    className={`${styles.image} ${fit === 'contain' ? styles.contain : ''} ${loading ? styles.hidden : ''}`}
                    onError={() => {
                        setError(true);
                        setImageUrl(PLACEHOLDER);
                    }}
                />
            )}
        </div>
    );
}

function resolveImageUrl(uri: string): string {
    if (!uri) return PLACEHOLDER;

    // IPFS
    if (uri.startsWith('ipfs://')) {
        return uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Arweave
    if (uri.startsWith('ar://')) {
        return uri.replace('ar://', 'https://arweave.net/');
    }

    // Data URI - return as-is
    if (uri.startsWith('data:')) {
        return uri;
    }

    // HTTP(S) - return as-is
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
    }

    // Unknown - might be IPFS CID
    if (uri.length === 46 || uri.length === 59) {
        return `https://ipfs.io/ipfs/${uri}`;
    }

    return uri;
}
