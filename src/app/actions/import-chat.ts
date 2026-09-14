"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function importDiscoveredPatient(formData: FormData): Promise<void> {
  const jid = formData.get("jid") as string;
  const phone = formData.get("phone") as string;
  const name = (formData.get("name") as string) || `Patient ${phone}`;

  if (!jid || !phone) return;

  try {
    // 1. Create or link the registered Client record
    await prisma.client.upsert({
      where: { phone },
      update: { name },
      create: { name, phone },
    });

    // 2. Mark the chat as imported in the discovered staging table
    await prisma.discoveredChat.update({
      where: { jid },
      data: { imported: true },
    });

    revalidatePath("/whatsapp-sync");
    revalidatePath("/");
  } catch (error) {
    console.error("Failed to import contact as patient:", error);
  }
}