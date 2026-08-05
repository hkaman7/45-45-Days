# 45+45 days: A national warning-to-response platform for weather-driven risk to U.S. food and agricultural systems.

🔗 **Live demo:** [hkaman7.github.io/45-45-Days](https://hkaman7.github.io/45-45-Days/)

## What is 45+45?

Weather and climate extremes, heat waves, frosts, floods, cost U.S. agriculture billions of dollars a year, and the disruption tends to arrive in predictable waves tied to large-scale climate patterns like El Niño. The problem isn't a lack of warning or a lack of after-the-fact damage reports; it's that the two have never been connected. Producers get regional forecasts with no crop-level translation, and they get damage assessments only after the loss has already happened. By the time the numbers are in, the window for doing anything about it has closed.

45+45 closes that gap with two connected capabilities, each covering a 45-day window on either side of a weather event:

- **45 days before**, a subseasonal early-warning outlook translates weather forecasts into crop-specific, county- and field-level risk: which crops, in which places, are heading toward heat, frost, or flood stress, and how likely that stress is to affect yield.
- **45 days after**, a rapid post-event impact assessment shows what actually happened, using satellite observations to compare field conditions before and after a confirmed event, so producers and agencies know where damage occurred and how severe it is, in days rather than weeks.

Together, they turn a one-way stream of forecasts and reports into a continuous loop: anticipate, act, then confirm what happened, on a timeline that still leaves room to do something about it.

## What's in this demo

This repository hosts a working prototype of the platform's first two capabilities:

### 🗺️ Risk Viewer
A national, county-level outlook for the weeks ahead, weeks 3 through 6 out. Select a crop and a hazard product, crop stress, heatwave probability, crop-loss probability, expected yield reduction, or overall risk classification, and see how it plays out across the country and changes week by week. Click into any county for the specific numbers behind the map, down to individual fields where field-level detail is available.

### ⚡ Rapid Response
When a heat event is confirmed, this view shows what happened on the ground: satellite-based crop health before and after the event, side by side, with the acreage affected and an observed crop-loss estimate, shown alongside the original forecast for comparison. Every report can be exported as a PDF summary for sharing.

Both views are built for anyone who needs a fast, visual read on agricultural risk, no technical background required, and every product includes a "Generate PDF Report" option for a shareable, ready-to-read summary.

## Who it's for

Producers, county extension agents, crop insurers, and USDA agencies who currently have no single source of crop-specific, forward-looking risk intelligence connected to timely post-event confirmation. 45+45 is designed to be a source others can build on too: the roadmap includes an open API so that other agricultural and emergency-response tools can pull these products directly into their own workflows.

## Status

This is an active prototype demonstrating the platform's core concept ahead of full national build-out. Current coverage focuses on corn (Corn Belt) and grapes (California) as proof-of-concept crops, with the broader vision covering the hazard-prone regions across the continental U.S., from summer heat stress in the Midwest to frost risk in the Southeast to flooding along the Gulf Coast.
