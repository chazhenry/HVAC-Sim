"""EPA Section 608 practice question bank.

These are original practice questions written for this trainer, not questions
from any real exam. Regulatory figures were checked against epa.gov/section608
(service practice, leak repair and technician certification pages) in
November 2026 - re-check them when the rules change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from .models import ApiModel

Section = Literal["core", "type1", "type2", "type3"]
PASS_FRACTION = 0.7


@dataclass(frozen=True)
class Question:
    id: str
    section: Section
    prompt: str
    choices: tuple[str, ...]
    answer: int
    explanation: str


class SectionInfo(ApiModel):
    id: Section
    title: str
    covers: str
    question_count: int


class PublicQuestion(ApiModel):
    id: str
    prompt: str
    choices: list[str]


class ExamPaper(ApiModel):
    section: SectionInfo
    pass_percent: int
    questions: list[PublicQuestion]


class GradeExamRequest(ApiModel):
    answers: dict[str, int]


class QuestionResult(ApiModel):
    id: str
    chosen: int | None
    correct_index: int
    correct: bool
    explanation: str


class ExamResult(ApiModel):
    correct: int
    total: int
    percent: int
    passed: bool
    results: list[QuestionResult]


SECTION_META: dict[Section, tuple[str, str]] = {
    "core": ("Core", "Ozone and climate, the rules, the three R's, cylinders, safety, dehydration"),
    "type1": ("Type I", "Small appliances: factory-sealed, 5 lb of refrigerant or less"),
    "type2": ("Type II", "High- and very-high-pressure appliances: residential and commercial A/C"),
    "type3": ("Type III", "Low-pressure appliances: centrifugal chillers"),
}


def _q(section: Section, n: int, prompt: str, choices: tuple[str, ...], answer: int, explanation: str) -> Question:
    return Question(f"{section}-{n:02d}", section, prompt, choices, answer, explanation)


QUESTIONS: tuple[Question, ...] = (
    # ------------------------------------------------------------------ core
    _q("core", 1, "Chlorine from CFC and HCFC refrigerants does its damage in which part of the atmosphere?",
       ("The troposphere", "The stratosphere", "The ionosphere", "At ground level"), 1,
       "The ozone layer that shields the earth from UV-B is in the stratosphere. One chlorine atom can destroy many thousands of ozone molecules there."),
    _q("core", 2, "Which class of refrigerant has the highest ozone depletion potential?",
       ("HFCs such as R-410A", "HCFCs such as R-22", "CFCs such as R-12", "HFOs such as R-1234yf"), 2,
       "CFCs contain the most chlorine and are the most stable, so they reach the stratosphere intact. HCFCs are lower; HFCs and HFOs contain no chlorine and have zero ODP."),
    _q("core", 3, "R-410A is best described as:",
       ("An HCFC with a low ozone depletion potential", "A CFC blend", "An HFC blend with zero ozone depletion potential but a high global warming potential", "A natural refrigerant"), 2,
       "R-410A is a blend of the HFCs R-32 and R-125. It does not harm the ozone layer but is a potent greenhouse gas, which is why venting it is still prohibited."),
    _q("core", 4, "To RECOVER refrigerant means to:",
       ("Clean it for reuse by separating oil and passing it through filter-driers", "Remove it from a system in any condition and store it in an external container", "Reprocess it to new-product specification", "Release it slowly to atmosphere"), 1,
       "Recover = remove and store, with no testing or processing implied. Cleaning on site is recycling; processing to new-product purity is reclaiming."),
    _q("core", 5, "Refrigerant that is to be sold to a new owner must first be:",
       ("Recovered", "Recycled on site", "Reclaimed to the AHRI 700 purity standard", "Mixed with virgin refrigerant"), 2,
       "Only reclaimed refrigerant - reprocessed and verified by chemical analysis to the AHRI 700 standard - may change ownership. Recovered or recycled refrigerant may go back into equipment of the same owner."),
    _q("core", 6, "A refillable recovery cylinder must never be filled beyond what share of its capacity?",
       ("60%", "80%", "95%", "100%"), 1,
       "Liquid refrigerant expands as it warms. The 80% limit leaves vapor space so a warm cylinder does not go hydrostatic and rupture."),
    _q("core", 7, "A refillable refrigerant recovery cylinder is identified by its:",
       ("Light blue body", "Rose (pink) body", "Gray body with a yellow top", "Green body with a white top"), 2,
       "Recovery cylinders are gray with a yellow shoulder. They also carry a DOT stamp and must be hydrostatically retested on schedule."),
    _q("core", 8, "Which of these may legally be released to the atmosphere?",
       ("R-410A left in the hoses of a full system", "R-22 from a unit that is about to be scrapped", "Dry nitrogen used to pressure-test a system after the refrigerant was recovered", "Any HFC, because HFCs do not deplete ozone"), 2,
       "The venting prohibition covers ozone-depleting refrigerants and their substitutes, including HFCs. Nitrogen used for testing after proper recovery may be released."),
    _q("core", 9, "Which gas must NEVER be used to pressurise a refrigerant circuit?",
       ("Dry nitrogen", "Oxygen", "Nitrogen with a trace of refrigerant", "Carbon dioxide"), 1,
       "Oxygen (and compressed air) mixed with refrigerant oil under pressure can explode. Use dry nitrogen."),
    _q("core", 10, "When pressurising a system from a nitrogen cylinder you must use:",
       ("A pressure regulator, with a relief valve downstream of it", "The cylinder valve alone, opened slowly", "A manifold gauge set as the only control", "A vacuum pump in line"), 0,
       "A full nitrogen cylinder is above 2,000 psig. A regulator sets test pressure and a downstream relief valve protects the system if the regulator fails."),
    _q("core", 11, "The main reason a system is evacuated (dehydrated) before charging is to:",
       ("Remove moisture and non-condensable gases such as air", "Cool the compressor", "Recover the last of the oil", "Test the compressor valves"), 0,
       "Moisture reacts with refrigerant and oil to form acids and can freeze at the metering device; air raises head pressure. A deep vacuum boils the moisture off."),
    _q("core", 12, "A deep vacuum is measured accurately with:",
       ("The compound gauge on the manifold", "An electronic micron (vacuum) gauge", "A sight glass", "A clamp-on ammeter"), 1,
       "A manifold compound gauge cannot resolve the difference between 5,000 and 500 microns. A micron gauge can."),
    _q("core", 13, "Section 608 technician certification:",
       ("Expires every 2 years", "Expires every 5 years", "Does not expire", "Is only valid in the state that issued it"), 2,
       "EPA states that Section 608 credentials do not expire. Keep the card - you must be able to show it."),
    _q("core", 14, "Refrigerant in cylinders for stationary equipment may be sold to:",
       ("Anyone over 18", "Certified technicians (or their employers)", "Any licensed contractor of any trade", "Homeowners, for their own equipment"), 1,
       "The sales restriction limits refrigerant sales to certified technicians and the companies that employ them."),
    _q("core", 15, "Disposable (one-trip) refrigerant cylinders:",
       ("May be refilled once", "May be refilled if under 80% full", "Must never be refilled", "Are the preferred container for recovery"), 2,
       "Disposable cylinders are not built or tested for refilling. Recover into a refillable recovery cylinder."),
    _q("core", 16, "Mixing two different refrigerants in one recovery cylinder:",
       ("Is fine if both are HFCs", "Makes the mixture difficult or impossible to reclaim", "Raises the capacity of the cylinder", "Is required to save cylinders"), 1,
       "A mixture often cannot be separated economically and may have to be destroyed. Use a dedicated, labelled cylinder for each refrigerant."),
    _q("core", 17, "Refrigerant vapor released in a confined space is dangerous mainly because it:",
       ("Is lighter than air and collects at the ceiling", "Is heavier than air and displaces oxygen", "Is strongly flammable in every case", "Corrodes copper instantly"), 1,
       "Most refrigerant vapors are heavier than air. In a pit or closed room they push the air out and cause asphyxiation with little warning."),
    _q("core", 18, "With liquid and vapor both present in a cylinder, its pressure depends on:",
       ("How full the cylinder is", "The refrigerant's temperature", "The size of the cylinder", "The colour of the cylinder"), 1,
       "A saturated refrigerant's pressure is set by its temperature - the basis of the pressure-temperature chart. Quantity does not change it until the liquid is gone."),
    _q("core", 19, "Before an appliance is disposed of, its refrigerant must be:",
       ("Left in place for the scrap yard in every case", "Recovered", "Vented outdoors", "Diluted with nitrogen"), 1,
       "Refrigerant must be recovered before disposal. The final person in the disposal chain is responsible for making sure it was."),
    _q("core", 20, "Air left in a refrigeration system (non-condensables) shows up as:",
       ("Lower than normal head pressure", "Higher than normal head pressure", "A frosted suction line", "Low compressor amps"), 1,
       "Air collects in the condenser, takes up surface and adds its own pressure, so head pressure and compressor amps rise."),
    # ---------------------------------------------------------------- type 1
    _q("type1", 1, "For Section 608, a small appliance is one that is:",
       ("Under 5 tons of cooling", "Factory charged and hermetically sealed with 5 lb of refrigerant or less", "Any appliance in a home", "Any appliance using R-134a"), 1,
       "Type I covers products fully manufactured, charged and hermetically sealed in a factory with five pounds or less of refrigerant."),
    _q("type1", 2, "Which of these is a small appliance?",
       ("A 3-ton residential split system", "A household refrigerator", "A walk-in cooler", "A rooftop packaged unit"), 1,
       "Household refrigerators and freezers, window air conditioners, water coolers and dehumidifiers are typical small appliances. A split system is field-charged and falls under Type II."),
    _q("type1", 3, "Using recovery equipment made after November 15, 1993 on a small appliance with a WORKING compressor, you must recover:",
       ("70% of the charge", "80% of the charge", "90% of the charge", "100% of the charge"), 2,
       "90% with a working compressor and post-1993 equipment. Alternatively, evacuate the appliance to 4 inches of mercury vacuum."),
    _q("type1", 4, "If the small appliance's compressor does NOT run, you must recover:",
       ("80% of the charge", "90% of the charge", "50% of the charge", "Nothing - recovery is waived"), 0,
       "80% when the compressor is not functional (or when using pre-1993 recovery equipment)."),
    _q("type1", 5, "Instead of meeting the percentage, a small appliance may be evacuated to:",
       ("0 inches Hg", "4 inches Hg vacuum", "15 inches Hg vacuum", "500 microns"), 1,
       "EPA accepts evacuating a small appliance to 4 inches of mercury vacuum as an alternative to the 80% / 90% requirement."),
    _q("type1", 6, "System-dependent (passive) recovery relies on:",
       ("A self-contained recovery machine with its own compressor", "The appliance's own compressor or internal pressure to move the refrigerant", "A vacuum pump", "Nitrogen pressure"), 1,
       "Passive recovery uses the appliance compressor, or heat and pressure difference, to push refrigerant into a container. It is only permitted on small charges."),
    _q("type1", 7, "When recovering from a small appliance whose compressor does not run, you should:",
       ("Access the low side only", "Access both the high and low sides", "Cut the capillary tube", "Skip recovery"), 1,
       "Without a running compressor there is nothing to move refrigerant past the metering device, so both sides must be accessed to get the charge out."),
    _q("type1", 8, "Solderless piercing access valves fitted for recovery should be:",
       ("Left on permanently as service ports", "Removed or replaced with a proper fitting when the job is done", "Tightened as far as possible and left", "Painted over"), 1,
       "Piercing valves tend to leak over time. They are for temporary access, not permanent service ports."),
    # ---------------------------------------------------------------- type 2
    _q("type2", 1, "Type II certification covers:",
       ("Small appliances only", "High- and very-high-pressure appliances, except small appliances and motor vehicle A/C", "Low-pressure chillers", "Motor vehicle air conditioning"), 1,
       "Type II is the certification for most residential and commercial air conditioning and refrigeration: R-22, R-410A, R-404A and similar."),
    _q("type2", 2, "A residential R-410A split system holds 7 lb. Before opening it for a major repair, it must be recovered to at least:",
       ("0 inches Hg", "4 inches Hg vacuum", "10 inches Hg vacuum", "15 inches Hg vacuum"), 0,
       "High-pressure appliances with a full charge under 200 lb must be recovered to 0 inches Hg (atmospheric pressure), with equipment made before or after 1993."),
    _q("type2", 3, "A high-pressure appliance holding 250 lb, serviced with recovery equipment made after November 15, 1993, must be recovered to:",
       ("0 inches Hg", "4 inches Hg vacuum", "10 inches Hg vacuum", "25 mm Hg absolute"), 2,
       "At 200 lb or more a high-pressure appliance must be taken to 10 inches Hg vacuum with post-1993 equipment (4 inches with older equipment)."),
    _q("type2", 4, "The leak-rate trigger for COMFORT COOLING appliances above the charge threshold is:",
       ("5% per year", "10% per year", "20% per year", "30% per year"), 1,
       "Comfort cooling and other appliances: 10%. Commercial refrigeration: 20%. Industrial process refrigeration: 30%. Rates are over a 12-month period."),
    _q("type2", 5, "The leak-rate trigger for COMMERCIAL REFRIGERATION is:",
       ("10% per year", "20% per year", "30% per year", "35% per year"), 1,
       "20% for commercial refrigeration. The older 35% and 15% figures have been superseded."),
    _q("type2", 6, "The leak-rate trigger for INDUSTRIAL PROCESS REFRIGERATION is:",
       ("10% per year", "20% per year", "30% per year", "50% per year"), 2,
       "30% for industrial process refrigeration."),
    _q("type2", 7, "When an appliance exceeds its leak-rate trigger, the owner must generally repair it within:",
       ("7 days", "30 days", "90 days", "One year"), 1,
       "30 days from discovery (120 days if an industrial process shutdown is needed), followed by initial and follow-up verification tests."),
    _q("type2", 8, "Leak repair rules apply to an HFC appliance (such as R-410A) once its full charge is at least:",
       ("5 lb", "15 lb", "50 lb", "200 lb"), 1,
       "Under the AIM Act rules in force from January 1, 2026 the threshold for HFC appliances is 15 lb. For ozone-depleting refrigerants under Section 608 it is 50 lb."),
    _q("type2", 9, "The fastest way to recover a large charge is to remove:",
       ("Vapor first, then liquid", "Liquid first, then the remaining vapor", "Vapor only", "Oil first"), 1,
       "Liquid carries far more mass per minute than vapor. Pull liquid first, then finish with vapor recovery."),
    _q("type2", 10, "After a major repair, the correct order is:",
       ("Charge, then leak check with soap", "Pressure test with dry nitrogen, evacuate, then charge", "Evacuate, charge, then pressure test with nitrogen", "Charge with oxygen to find leaks"), 1,
       "Prove the system is tight with nitrogen first - a vacuum is a poor leak test. Then dehydrate with a deep vacuum, then charge."),
    _q("type2", 11, "A system is pulled to 400 microns and valved off. The reading rises to 1,500 microns and levels off. This indicates:",
       ("A leak", "Moisture still boiling off in the system", "A tight, dry system", "A failed micron gauge"), 1,
       "A rise that levels off is moisture (or refrigerant) still vaporising. A reading that keeps climbing toward atmospheric pressure is a leak. A dry, tight system holds near where it was valved off."),
    _q("type2", 12, "Running a vacuum pump on a system that still holds refrigerant under pressure will:",
       ("Speed up dehydration", "Vent refrigerant through the pump and damage it", "Recover the refrigerant", "Have no effect"), 1,
       "A vacuum pump exhausts to atmosphere, so this is venting. Recover to the required level first."),
    # ---------------------------------------------------------------- type 3
    _q("type3", 1, "Which is a low-pressure appliance?",
       ("An R-410A heat pump", "A centrifugal chiller using R-123", "An R-404A walk-in freezer", "An R-134a vending machine"), 1,
       "Low-pressure refrigerants such as R-11 and R-123 are used in centrifugal chillers, whose evaporators run below atmospheric pressure."),
    _q("type3", 2, "The required evacuation level when recovering from a low-pressure appliance is:",
       ("0 inches Hg", "10 inches Hg vacuum", "15 inches Hg vacuum", "25 mm Hg absolute"), 3,
       "Low-pressure appliances must be evacuated to 25 mm Hg absolute."),
    _q("type3", 3, "Because part of a low-pressure chiller runs in a vacuum, a leak will usually:",
       ("Spray liquid refrigerant out", "Draw air and moisture into the machine", "Raise the oil level", "Trip the low-pressure switch only"), 1,
       "Air and moisture leak inward. A purge unit removes the non-condensables that collect in the condenser."),
    _q("type3", 4, "The rupture disc on a low-pressure chiller typically relieves at about:",
       ("15 psig", "50 psig", "150 psig", "300 psig"), 0,
       "Low-pressure machines are protected by a rupture disc set around 15 psig, so they must never be pressurised above that."),
    _q("type3", 5, "When raising pressure in a low-pressure chiller to leak test it, do not exceed:",
       ("10 psig", "50 psig", "150 psig", "The nitrogen cylinder pressure"), 0,
       "Keep the test at or below 10 psig - safely under the 15 psig rupture disc. Warm water or controlled nitrogen is used to raise the pressure."),
    _q("type3", 6, "Recovery from a low-pressure chiller should start with:",
       ("Vapor", "Liquid", "Oil", "Purge gas"), 1,
       "Remove liquid first, then recover the remaining vapor - a large chiller still holds a lot of refrigerant as vapor once the liquid is gone."),
    _q("type3", 7, "While evacuating a water-cooled chiller, water should be circulated through the tubes to:",
       ("Clean the tubes", "Stop the water freezing as the refrigerant boils off", "Speed up the vacuum pump", "Cool the purge unit"), 1,
       "Boiling refrigerant in a vacuum gets very cold. Still water in the tubes can freeze and split them."),
    _q("type3", 8, "A low-pressure chiller under deep vacuum is first charged with:",
       ("Liquid, to save time", "Vapor, until the saturation temperature is above freezing", "Nitrogen", "Oil"), 1,
       "Liquid entering a deep vacuum flashes and can freeze the water in the tubes. Charge vapor until the saturation temperature is above 32 F, then liquid."),
)

QUESTIONS_BY_SECTION: dict[Section, tuple[Question, ...]] = {
    s: tuple(q for q in QUESTIONS if q.section == s) for s in SECTION_META
}


def section_info(section: Section) -> SectionInfo:
    title, covers = SECTION_META[section]
    return SectionInfo(id=section, title=title, covers=covers, question_count=len(QUESTIONS_BY_SECTION[section]))


def paper(section: Section) -> ExamPaper:
    return ExamPaper(
        section=section_info(section),
        pass_percent=round(PASS_FRACTION * 100),
        questions=[
            PublicQuestion(id=q.id, prompt=q.prompt, choices=list(q.choices))
            for q in QUESTIONS_BY_SECTION[section]
        ],
    )


def grade_exam(section: Section, answers: dict[str, int]) -> ExamResult:
    results = [
        QuestionResult(
            id=q.id,
            chosen=answers.get(q.id),
            correct_index=q.answer,
            correct=answers.get(q.id) == q.answer,
            explanation=q.explanation,
        )
        for q in QUESTIONS_BY_SECTION[section]
    ]
    correct = sum(r.correct for r in results)
    total = len(results)
    return ExamResult(
        correct=correct,
        total=total,
        percent=round(100 * correct / total),
        passed=correct >= PASS_FRACTION * total,
        results=results,
    )
