# Lots, harvest, and quality

**Wouri** · Where your chain starts, and how to keep it trustworthy. No em-dashes.

Who: field agent, export manager. Time: 10 minutes.

## What a lot is

A **lot** is a quantity of one commodity moving through custody. Everything in
Wouri hangs off lots: documents, weights, quality, and the tamper-evident history.

## Where does your chain start

Open **Lots**. At the top is a choice, because not everyone starts at the same
place:

- **At harvest.** You own the plot. Capture the origin: a plot code, its area,
  and, if you have it, the plot boundary as GeoJSON. The first event on the lot is
  the harvest.
- **Received after harvest.** You bought the lot from a supplier. Record the
  supplier name and, if they gave you one, an origin reference. The first event is
  the receipt.

Both are valid. Most exporters buy after harvest, so that path is first-class, not
an afterthought.

## The EUDR origin gap

For an EUDR commodity (cocoa, coffee, palm oil, rubber, timber), the EU needs the
plot geolocation. If your lot does not have it yet, Wouri does **not** block you.
It flags the lot on the readiness board as an **origin gap** so you can chase the
geolocation from your supplier before the container reaches the border. Cotton and
banana are outside EUDR and are not flagged.

## Create a lot

1. Choose **At harvest** or **Received after harvest**.
2. Pick the commodity (all eight are here; EUDR ones are marked).
3. Enter a lot code and the quantity in kilograms.
4. Fill the fields for your chosen entry point (plot details, or supplier).
5. Tick **CITES species** only for a listed timber species. A CITES lot can never
   be mass-balanced; Wouri enforces this.
6. Press **Create lot**.

## The lot detail: timeline, chain, quality

Click a lot to open it. Three things:

- **Custody timeline.** Every event on the lot, in order, sealed and numbered. You
  cannot edit history; corrections are new events.
- **Chain status.** A badge that reads **Chain intact** when the tamper-evident
  hash chain verifies. If anyone altered a stored event, it would read broken.
- **Quality.** For each attribute your commodity declares (moisture, bean count,
  and so on), type the measured value and press **Record**. Wouri checks it
  against the accepted range and shows it green (in range) or red (out of range).

Recording quality matters: the **quality certificate** can only be issued once its
values exist. No numbers, no certificate. That is the point.

## Tips

- You do not need the plot polygon to start. Record it later; the board reminds
  you.
- Quality values are dated and kept. The latest per attribute is what the
  certificate uses.

Next: [Consignments and documents](consignments-documents.md).
