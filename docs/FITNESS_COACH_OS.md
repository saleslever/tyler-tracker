# Fitness Coach OS

## Product mandate
Build a persistent, data-driven fitness coach inside Tyler Tracker. It must prescribe training, enforce accountability, read the user’s actual historical data, and explain coaching decisions. It is not a generic chatbot.

## Experience
- Light, professional health dashboard; remove the black visual scheme.
- Remove gamification: no quests, points, badges, challenges, or streak pressure.
- Preserve and improve the daily habit list, including alcohol tracking and fasting.
- Preserve fasting history, alcohol history, and the user’s current 13-day sober status.

## Coach requirements
- Daily coaching conversation, workout assignment, nutrition/recovery review, and accountability.
- Coach context must come from the persistent data center: goals, scans, calorie/protein targets, macros, weight, recovery, workout plans, actual workouts, substitutions, direct-set volume, cardio, swimming, basketball, fasting, alcohol, and habits.
- Support screenshot/image upload with a review step before extracted data becomes a saved record.
- Coach-generated plans are separate from completed workout logs.
- Before prescribing a workout, show completed direct sets, today’s planned direct sets, and remaining weekly volume.

## Training rules
- Four full-body training days: Monday, Tuesday, Thursday, Friday.
- Every major body part appears in every lifting day.
- Target 24 direct working sets per body part each week.
- Count direct exercise credit only; do not double-count compound-assisting muscles.
- Rotate exercises through the week for front/side/rear delts, biceps long/short head plus brachialis work, and triceps long/lateral/medial emphasis.
- Include calves, core, compound movements, isolation work, explosive work, recovery, cardio/swimming, and Saturday basketball.
- Prefer Smith-machine shoulder presses. Regular lunges are an approved Bulgarian-split-squat substitute.

## Persistent data center
Record historical goals, body scans, macro check-ins, weigh-ins, recovery, sleep, soreness, workouts, exercises, sets, reps, loads, substitutions, habits, alcohol, fasting, cardio, swimming, basketball, coach conversations, and coach decisions. Actual records must never be overwritten by later plan changes.

## Analytics
Provide daily, 7-day, 14-day, and 30-day averages; weight trends; macro adherence; direct-set volume; progression; recovery trends; workout completion; alcohol and fasting history; and goal progress.

## Data retention and reset
Preserve daily habits and history, alcohol data and the 13-day sober status, fasting tracker and history, and useful journal/accountability data. Remove legacy gamification data from the product experience. Any production-data reset or migration requires a separate explicit approval before it runs.

## Deployment
Build and review on feature/fitness-coach-os, then merge to main for deployment at the existing live URL. AI provider credentials must be server-side environment variables and never committed to the repository.
