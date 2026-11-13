# Equipment contexts and tutor feedback

The menu offers the original generic residential A/C, the original 80% gas furnace,
and a Goodman GSZB403610A heat pump paired with an AMST36CU1400 air handler.
Choose the equipment context, then choose a compatible service call. The heat pump
adds winter heating and defrost calls alongside the original outdoor-unit faults.

## JSON configuration

Use **Save configuration JSON** in the menu or equipment card to download the full
active definition. **Load configuration JSON** validates and selects a saved file.
The menu's **Create or edit a context** editor lets you modify a copy, change its
ID/name, apply it, and export it. Invalid files leave the current selection intact.
Imports are limited to 128 KB; schema version 1 and equipment compatibility are
validated by `POST /api/contexts/validate`.

Built-in definitions live in `backend/app/equipment/*.json`. The canonical schema
is `EquipmentContext` in `backend/app/models.py`. A definition contains identity,
indoor pairing, nominal component values, supply voltage, cabinet dimensions/color,
default environment, source documents, notes, and heat-pump controller settings.
The JSON defines equipment; it is not a saved job, answer key, or grading result.
Imported contexts are available for the current page visit; save the JSON to keep them.

On session creation the backend applies the selected scenario's faults over the
equipment's nominal values. It stores the complete context in SQLite
`session_contexts`, so hints, tutor context, and grading continue to use that definition
after a backend restart. Generic furnace and A/C fault libraries are preserved.

## Goodman model

The installed-base R-410A GSZB4 family is used deliberately; this is not the newer
R-32 product. The [Goodman specification sheet](https://www.amgair.com/content/documents/goodman/SpecSheet-gszb4.pdf)
and [parts manual](https://theacoutlet.com/cdn/shop/files/Repair-Parts-Goodman-GSZB4.pdf)
provide the selected outdoor unit's dimensions, ratings, charge, and run capacitor.
The [Goodman catalog](https://apps.goodmanmfg.com/brochures/files/649f4676180f7CT-GOODMAN_FullCat%205.23.pdf)
describes the AMST air handler's ECM blower and TXV. Efficiency is a family rating;
exact performance requires the applicable AHRI combination.

The control model connects thermostat Y to the defrost board, contactor and
compressor; O powers the reversing valve in cooling/defrost, while W2 requests
auxiliary heat at the indoor air handler. Outdoor fan contacts open during defrost.
The single-pole contactor keeps its L2 shunt energized until the disconnect is pulled.
R/C/Y/O/W2 terminals can be probed with the existing meter. The thermostat offers
both COOL and HEAT. Use **Defrost board TEST** with a running heat call and a closed
cold-coil sensor to advance the interval timer, then observe the shift delays,
fan stop, auxiliary heat and return to heating. The true suction port is separate
from the large vapor service line, which carries hot gas in heating mode.

The [manufacturer installation reference](https://device.report/m/de82a17ddae682bf6021ca211027e72c905263c0c884e6843cbcf346d2b67838_optim.pdf)
documents selectable defrost intervals and SmartShift. Winding resistance, sensor
thresholds, thermal ramps, 30-second shift delays, pressure thresholds and the optional
5 kW auxiliary heater are explicit training assumptions. Exposed controller settings
can be changed in the JSON. The schematic
is a simplified training diagram, not a reproduction of a factory wiring/charging chart.
The application remains a private demonstration, not HVAC guidance.

## Reply feedback

Successful tutor replies have thumbs-up/down controls. Each opens a modal with the
original prompt and answer in read-only fields and a required explanation. The
signed-in account's email is attached automatically, including when localStorage is
unavailable for this visit. Local slash-command responses and failed requests are
not LLM replies and have no rating controls.

`POST /api/feedback` accepts `replyId`, `rating` (`up` or `down`), `explanation`, and
`user`. The backend obtains the prompt and answer from its `chat_replies` table;
client-supplied replacements cannot alter the original exchange. SQLite `feedback`
stores the account email and user ID, rating, explanation, exchange, session/reply IDs and UTC time.
The backend derives identity from the authenticated session and checks job ownership.
Submitting again for the same account/reply updates that feedback record. Feedback is
intentional and is saved for admin/localhost guests too; their automatic visit and
activity analytics remain excluded. Feedback has no public read endpoint.
