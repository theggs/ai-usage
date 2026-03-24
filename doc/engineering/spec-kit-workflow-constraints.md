# Spec-Kit Workflow Constraints

This document defines the operating constraints for running the `spec-kit` workflow in this repository. It exists to prevent a recurring failure mode: a feature looks complete in `spec.md`, `plan.md`, `tasks.md`, code, and unit tests, but still requires multiple rounds of avoidable UI or interaction rework after real use.

These constraints do not ask product requirements to become implementation specs. Instead, they define what the implementer must still own even when the product artifacts are correct.

## Core Principle

`spec-kit` defines what the product should do and what outcomes matter.

Implementation still owns:

- translating those outcomes into a coherent UI or interaction design
- handling standard runtime and interaction behaviors without waiting for the user to enumerate them
- validating the result in the real runtime when the environment matters

Do not push normal frontend or desktop interaction responsibilities back into `spec.md`.

## What Spec-Kit Is Not Responsible For

The following usually should not be forced into the product spec just to make implementation safe:

- basic drag feedback behavior
- expected state cleanup when an interaction ends
- layout remaining stable at the actual shell width used by the app
- avoiding obvious overlay, transform, z-index, or event-lifecycle mistakes
- avoiding obvious visual or interaction mismatches against the provided wireframe or reference screen

If a feature needs these to feel complete, the implementer must account for them during planning, implementation, and validation.

## Required Operating Rules

### 1. Risk Review After Planning

After `speckit-plan`, perform an implementation risk review before coding starts whenever the feature includes any of the following:

- significant UI redesign
- drag-and-drop
- overlays or floating elements
- animation or view transitions
- responsive or shell-width-sensitive layout
- desktop-window-specific behavior

The review should identify:

- runtime-sensitive behaviors
- browser or shell traps
- coordination risks between layout, animation, and interaction state
- areas where unit tests are insufficient evidence

This review must be captured in a durable, searchable repository artifact such as `plan.md`, task notes stored in the repo, or an engineering document under `doc/engineering/`. It must not exist only in transient conversation.

### 2. Task Quality Check After Task Generation

After `speckit-tasks`, verify that the task list covers quality gates in addition to feature work.

For UI or interaction-heavy work, the tasks must account for:

- implementation of the intended behavior
- runtime verification in the actual app environment
- screenshot or visual comparison when layout or polish matters
- abnormal-path verification such as cancellation, blur, release outside the component, failed persistence, or rollback

If those checks are missing, treat the task list as incomplete even if every requirement appears mapped.

### 3. Real Runtime Validation Is Mandatory For Environment-Sensitive UI

Vitest and RTL are useful, but they are not sufficient evidence for:

- drag-and-drop interactions
- overlays and portals
- coordinate-based positioning
- transformed ancestors affecting layout
- shell transitions between panel and settings
- visual fidelity against wireframes or existing product surfaces

For these cases, completion requires validation in the running app or through the approved E2E workflow.

See [e2e-automation-guide.md](/Users/chasewang/01workspace/projects/ai-usage/doc/engineering/e2e-automation-guide.md) for the supported automation path.

### 4. First-Pass UI Implementations Must Be Reviewed Visually

For desktop UI changes, do not wait until the end to look at the screen.

Expected sequence:

1. Implement the first pass.
2. Run the app or the screenshot automation.
3. Compare against the wireframe, proposal, or reference surface.
4. Correct the obvious visual or interaction mismatches.
5. Then continue with polish, cleanup, and final verification.

This is a normal part of implementation, not optional polish.

### 5. Completion Means User Problem Solved, Not Just Code Written

Do not mark work complete just because:

- the planned files were updated
- the nominal feature path exists
- unit tests pass
- requirements can be argued as technically covered

Completion requires confidence that the user-facing problem is solved in the real app.

For UI-heavy work, this means the result should:

- behave correctly
- look coherent against its reference
- avoid obvious interaction regressions
- clean up transient interaction state correctly

## Working Agreement For UI and Interaction Tasks

When implementing UI or interaction-heavy features in this repository, assume the implementer owns these professional defaults unless the user explicitly wants otherwise:

- maintain visual coherence with the referenced surface
- preserve usable interaction feedback during direct manipulation
- clean up temporary UI state when an interaction ends or is interrupted
- check the result at the actual shell size and runtime context used by the app
- treat abnormal-path behavior as part of the feature, not optional follow-up work

These are implementation responsibilities, not additional product requirements.

## Recommended Review Questions

Before starting implementation:

- What part of this feature is likely to fail only in the real app?
- Which behaviors would a professional frontend implementation be expected to get right even if the spec does not spell them out?
- Which interactions need runtime validation instead of only unit tests?

Before saying the work is done:

- Does the running app actually solve the problem the user reported?
- Does the result still match the reference layout or visual direction?
- Is any transient interaction state left behind after cancel, release, blur, or navigation?
- Did we verify the real behavior or only the code path?

## Using Speckit Analyze Correctly

When running `speckit-analyze`, do not stop at requirement coverage.

Also ask:

- Did planning identify the real implementation risks?
- Do the tasks include runtime validation and visual verification?
- Are high-risk interactions being treated as if unit tests alone are enough?
- Is anything that belongs to implementation judgment being incorrectly pushed into product requirements?

## Summary

The main protection against avoidable rework is not “write a more detailed spec.”

The protection is:

- plan with implementation risks in mind
- treat validation work as real work
- verify environment-sensitive behavior in the running app
- keep implementer responsibility separate from product-spec responsibility

Run `spec-kit` with those constraints every time, especially for desktop UI changes.
