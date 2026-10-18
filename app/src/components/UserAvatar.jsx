import { useEffect, useState } from "react";

export const DEFAULT_AVATAR_URL = "/default-avatar.svg";

export default function UserAvatar({ src, alt = "Avatar", className = "", style }) {
  const [current, setCurrent] = useState(src || DEFAULT_AVATAR_URL);

  useEffect(() => {
    setCurrent(src || DEFAULT_AVATAR_URL);
  }, [src]);

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      style={style}
      loading="lazy"
      onError={() => {
        setCurrent((value) => (value === DEFAULT_AVATAR_URL ? value : DEFAULT_AVATAR_URL));
      }}
    />
  );
}
