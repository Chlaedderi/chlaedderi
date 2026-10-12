import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";

import { useAppDispatch, useAppSelector } from "@app/hooks";
import { uiActions } from "@app/slices/uiSlice";

/** The short messages the old app showed at the bottom of the screen. */
export const Toasts = () => {
    const dispatch = useAppDispatch();
    const toasts = useAppSelector((s) => s.ui.toasts);
    const current = toasts[0];

    return (
        <Snackbar
            open={Boolean(current)}
            autoHideDuration={4000}
            onClose={() => current && dispatch(uiActions.dismissToast(current.id))}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
            sx={{ mb: "calc(64px + var(--sab))" }}
        >
            <Alert
                severity={current?.severity ?? "info"}
                variant="filled"
                onClose={() => current && dispatch(uiActions.dismissToast(current.id))}
            >
                {current?.message ?? ""}
            </Alert>
        </Snackbar>
    );
};
