export function WhatsAppSupportButton() {
  const phone = "5562996897483";
  const message = encodeURIComponent("Olá! Preciso de suporte com minha inscrição na Hope Conference.");
  const href = `https://wa.me/${phone}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:bg-[#1ebe5d] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 32"
        fill="currentColor"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.745.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.888 2.722.888.817 0 2.15-.515 2.478-1.318.13-.33.158-.673.158-1.017 0-.114-.027-.215-.054-.314-.094-.155-2.494-1.36-2.778-1.36zm-2.42 9.732c-1.84 0-3.643-.5-5.215-1.45L7.7 26.793l1.347-3.995a10.21 10.21 0 0 1-1.587-5.467c0-5.65 4.62-10.27 10.27-10.27a10.27 10.27 0 0 1 10.27 10.27c0 5.65-4.62 10.27-10.27 10.27zm0-22.43c-6.71 0-12.16 5.45-12.16 12.16 0 2.092.534 4.13 1.547 5.932L3 32l7.638-2.435a12.17 12.17 0 0 0 5.872 1.488c6.71 0 12.16-5.45 12.16-12.16S23.4 4.508 16.69 4.508z" />
      </svg>
    </a>
  );
}
