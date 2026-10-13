# Archived prototype

This folder preserves the visual reference and explicitly simulated demonstration from commit b8692a1. It is excluded from builds, typechecking and normal runtime imports. It is not a deployable financial application.

The old implementation contains simulated balances, transactions, provider credits and localStorage secrets. None of these are imported by the new product. Generated HTML in this archive must not be opened with a same-origin script-enabled iframe. The authenticated project APIs and isolated runtime replace its generation, publishing and finance behavior.

Only the explicit private legacy import flow accepts validated title, description, prompt and HTML. It rejects credentials and never imports wallet state, roles, transactions, balances, provider credits or fictitious consumption.
