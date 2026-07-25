import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { DeleteCustomBackground } from "@/features/configurator/delete-custom-background";

export const metadata: Metadata = {
  title: "Delete custom background",
  description: "Use a private WallCab deletion link to remove an upload.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function DeleteCustomBackgroundPage() {
  return (
    <>
      <PageIntro
        eyebrow="Private deletion"
        title="You control the upload."
        description="The secret in this page address stays in your browser until you confirm deletion."
        meta="No account required"
      />
      <DeleteCustomBackground />
    </>
  );
}
