import './ethos-ia.ts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<div>
  Ethos-ia test
  <ethos-ia name="ethosIA" endpoint="/api/chat"></ethos-ia>
  </div>`;
