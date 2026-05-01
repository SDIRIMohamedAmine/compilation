// utils/downloadSVG.js
// Utility: export any SVG element as a .svg file download
// Usage: downloadSVG(svgElement, "capteur_fsm")

export function downloadSVG(svgElement, filename = "diagram") {
  if (!svgElement) return;

  // Serialize the SVG
  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svgElement);

  // Inject Google Font reference so it renders offline too
  const fontLink = `<defs><style>
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&amp;display=swap');
  </style></defs>`;
  svgStr = svgStr.replace("<defs>", fontLink + "<defs>").replace(/^<svg/, `<svg xmlns="http://www.w3.org/2000/svg"`);

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href     = url;
  a.download = `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
