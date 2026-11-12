import { CameraOff, RefreshCw, Settings, ShieldAlert } from "lucide-react";
import type { CameraErrorKind } from "../../hooks/useCamera";
import { platform } from "../../platform";

interface CameraPermissionGuardProps {
  error: { kind: CameraErrorKind; message: string };
  onRetry: () => void;
}

export function CameraPermissionGuard({ error, onRetry }: CameraPermissionGuardProps) {
  const handleResetAndRetry = async () => {
    await platform.resetWebviewCameraPermissions();
    onRetry();
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-rose-200 bg-white/95 p-6 text-center shadow-xl backdrop-blur">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          {error.kind === "permission_denied" ? (
            <ShieldAlert className="h-7 w-7" />
          ) : (
            <CameraOff className="h-7 w-7" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          {error.kind === "permission_denied"
            ? "Camera Access Blocked"
            : error.kind === "in_use"
              ? "Camera Busy in Another App"
              : "Camera Unavailable"}
        </h3>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Camera
          </button>

          {platform.isTauri && error.kind === "permission_denied" && (
            <>
              <button
                onClick={() => void platform.openCameraPrivacySettings()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <Settings className="h-4 w-4" />
                OS Privacy Settings
              </button>
              <button
                onClick={() => void handleResetAndRetry()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
              >
                Reset WebView Permission
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

