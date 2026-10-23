import { createRoot } from "react-dom/client";
import { ProfileForm } from "../../src/app/account/profile/profile-form";
import Loading from "../../src/app/account/profile/loading";
import ErrorPage from "../../src/app/account/profile/error";
import { WorkspaceShell } from "../../src/components/workspace-shell";
import { navigationFor } from "../../src/config/account-navigation";
const params = new URLSearchParams(location.search);
const profile = {
  username: "00123-user",
  full_name: "Pengguna uji",
  phone: params.has("empty") ? "" : "081234567890",
  contact_email: params.has("empty") ? "" : "contact@example.org",
  bio: params.has("empty") ? "" : "Baris pertama\nBaris kedua",
  updated_at: "2026-10-23T10:11:12.123456+00:00",
};
if (params.has("long")) {
  profile.username = "UsernamePanjangTanpaSpasi".repeat(8);
  profile.full_name = "NamaPanjangTanpaSpasi".repeat(10);
  profile.bio = "A".repeat(2000);
}
Object.assign(window, { personalProfileFixture: profile });
const root = createRoot(document.getElementById("root")!);
Object.assign(window, { unmountPersonalProfile: () => root.unmount() });
root.render(
  <WorkspaceShell
    name="Akun uji"
    username="qa-profile"
    navigation={navigationFor([], false)}
  >
    {params.has("loading") ? (
      <Loading />
    ) : params.has("error") ? (
      <ErrorPage
        error={Error("private detail")}
        reset={() => {
          document.documentElement.dataset.retried = "true";
        }}
      />
    ) : (
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-4 py-6 sm:px-6"
      >
        <h1 className="text-3xl font-semibold">Profil pribadi</h1>
        <p className="text-sm text-muted-foreground">
          Perbarui identitas dan kontak akun Anda.
        </p>
        <ProfileForm initialProfile={profile} />
      </main>
    )}
  </WorkspaceShell>,
);
