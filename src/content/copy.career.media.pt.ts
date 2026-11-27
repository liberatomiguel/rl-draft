/**
 * v2.3 MEDIA (onda 2): as strings dos dias de mídia, em português do Brasil.
 * Gêmea de copy.career.media.en.ts, com as mesmas chaves. As marcas são
 * paródias fictícias; nenhuma é uma empresa real.
 */

type P = Record<string, string | number>;

/** O banco de marcas. CAREER_MEDIA.brands é o tamanho dele. */
const BRANDS_PT = [
  "Blue Stag Energy",
  "Tri-Stripe Athletics",
  "Pop-Sip Cola",
  "Logistik Gear",
  "Viper Edge Gaming",
  "Nvidious Graphics",
  "Interlock Chips",
  "Uberly Rides",
  "McDolan's Burgers",
  "Netflux",
  "Spotifly",
  "Amazin' Parcels",
  "Samsong Mobile",
  "Nubanco",
  "iFud Delivery",
] as const;

const DOW_PT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;

const brandOf = (p: P): string => BRANDS_PT[Number(p.brand) % BRANDS_PT.length];
const dayText = (dow: unknown, d: unknown, m: unknown): string => `${DOW_PT[(Number(dow) - 1) % 7]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
const rangeOf = (p: P): string => `de ${dayText(p.fromDow, p.fromD, p.fromM)} a ${dayText(p.toDow, p.toD, p.toM)}`;
const eventsOf = (p: P): string => (p.event2 ? `${p.event} e ${p.event2}` : String(p.event));

export const CAREER_MEDIA_PT = {
  brands: BRANDS_PT as readonly string[],
  /** Os botões sob a oferta na caixa de entrada (params: player, cash). */
  answers: {
    accept: (p: P) => `Aceitar: ${p.player} vai (${p.cash})`,
    decline: () => "Recusar",
  } as Record<string, (p: P) => string>,
  hint: "Uma oferta sem resposta vence como recusada no prazo. Nada mais muda.",
  /** A linha que substitui os botões quando a oferta se encerra. */
  closed: {
    accepted: (p: P) => `Você aceitou. ${p.player} fica fora ${rangeOf(p)}.`,
    declined: () => "Você recusou.",
    lapsed: () => "Não houve resposta no prazo, então a oferta venceu como recusada.",
    cancelled: () => "A viagem foi cancelada.",
  } as Record<string, (p: P) => string>,
  mail: {
    tpl: {
      mediaOffer: (p: P) => `${brandOf(p)} quer ${p.player} num dia de mídia`,
      mediaCalledOff: (p: P) => `Dia de mídia cancelado: ${p.player}`,
    } as Record<string, (p: P) => string>,
    body: {
      mediaOffer: (p: P) =>
        `A ${brandOf(p)} pediu ${p.player} para um dia de mídia, fora do clube ${rangeOf(p)} (${p.days} dias). Eles pagam ${p.cash}.\n\n` +
        (p.event ? `Ele perderia ${eventsOf(p)}.` : "Nenhum evento do seu time cai nesses dias.") +
        (Number(p.fatigue) ? `\n\nEle esteve num dia de mídia há pouco tempo, e ser enviado de novo tão cedo vai pesar no humor dele.` : "") +
        `\n\nVocê pode responder por esta mensagem até ${dayText(p.deadlineDow, p.deadlineD, p.deadlineM)}. Sem resposta, a oferta vence como recusada.`,
      mediaCalledOff: (p: P) =>
        p.why === "gone"
          ? `A ${brandOf(p)} cancelou o dia de mídia: ${p.player} não está mais no clube. Nada foi pago.`
          : `A ${brandOf(p)} cancelou o dia de mídia com ${p.player}: outro jogador já está fora de ${p.event}, e o time não pode ficar desfalcado. Nada foi pago.`,
    } as Record<string, (p: P) => string>,
  },
};
