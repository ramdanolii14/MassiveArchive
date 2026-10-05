export function Avatar({ src, name = "", large = false }) {
  return (
    <div className={`avatar${large ? " avatar-lg" : ""}`}>
      {src ? <img src={src} alt="" /> : (name[0] || "").toUpperCase()}
    </div>
  );
}