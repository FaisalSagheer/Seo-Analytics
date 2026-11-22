"use client";

import { ExternalLinkIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { getProductDetail, saveProductEdits, studioEditImage, studioSuggestText, type StudioText } from "@/lib/actions/merchant";
import { toForm } from "@/lib/merchant-products";
import type { ProductDoc } from "@/lib/providers/google";
import type { CatalogueRow } from "@/lib/shopping";
import { useCan } from "@/components/permissions-provider";
import { F, Pick } from "@/components/shopping/fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Tool = "remove" | "background" | "upscale";
const TOOLS: { value: Tool; label: string }[] = [
  { value: "remove", label: "Remove background (white)" },
  { value: "background", label: "New background from a description" },
  { value: "upscale", label: "Increase resolution" },
];
const TONES = [
  { value: "", label: "Default tone" },
  { value: "default", label: "Neutral" },
  { value: "playful", label: "Playful" },
  { value: "formal", label: "Formal" },
  { value: "persuasive", label: "Persuasive" },
  { value: "conversational", label: "Conversational" },
];

/** Product Studio: AI titles, descriptions and image edits for one product at a time. */
export function ProductStudio({ projectId, rows }: { projectId: string; rows: CatalogueRow[] }) {
  const canEdit = useCan("product-studio.edit");
  const [q, setQ] = useState("");
  const [product, setProduct] = useState<(ProductDoc & { ours: boolean }) | null>(null);
  const [loading, startLoading] = useTransition();
  const [pending, startTransition] = useTransition();
  const [tone, setTone] = useState("");
  const [lang, setLang] = useState("");
  const [text, setText] = useState<StudioText | null>(null);
  const [tool, setTool] = useState<Tool>("remove");
  const [scene, setScene] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return rows.filter((r) => r.title.toLowerCase().includes(t) || r.offerId.toLowerCase().includes(t)).slice(0, 8);
  }, [rows, q]);

  function open(name: string) {
    setText(null);
    setImage(null);
    startLoading(async () => {
      const res = await getProductDetail(projectId, name);
      if (!res.ok) return void toast.error(res.error);
      setProduct(res.data);
      setQ("");
    });
  }

  const attrs = product?.productAttributes ?? {};
  const imageLink = typeof attrs.imageLink === "string" ? attrs.imageLink : null;

  function suggest() {
    if (!product?.name) return;
    startTransition(async () => {
      const res = await studioSuggestText(projectId, product.name!, tone, lang);
      if (!res.ok) return void toast.error(res.error);
      setText(res.data);
      if (!res.data.title && !res.data.description) toast.info("Google had no suggestions for this product.");
    });
  }

  function apply(field: "title" | "description") {
    const s = text?.[field];
    if (!product?.name || !s) return;
    const before = toForm(product.productAttributes);
    startTransition(async () => {
      const res = await saveProductEdits(projectId, product.name!, before, { ...before, [field]: s.text });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${field === "title" ? "Title" : "Description"} saved to the product. Google may take a few minutes to show it.`);
      open(product.name!);
    });
  }

  function runImage() {
    if (!imageLink) return;
    startTransition(async () => {
      const res = await studioEditImage(projectId, imageLink, tool, scene);
      if (!res.ok) return void toast.error(res.error);
      setImage(res.data.src);
    });
  }

  return (
    <>
      <Alert>
        <SparklesIcon />
        <AlertDescription>
          Product Studio uses Google&apos;s AI. It&apos;s a Google preview, so it only works once Google enables it for this app&apos;s Google Cloud project. Nothing changes in Merchant Center until you apply a suggestion.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Product</CardTitle>
          <CardDescription>{product ? `${(attrs.title as string) || product.offerId} · ${product.offerId}` : "Search for the product to work on."}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="relative w-full sm:w-96">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input aria-label="Find a product" placeholder="Search title or ID" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {loading && <Spinner />}
          {matches.length > 0 && (
            <ul className="divide-y rounded-md border sm:w-96">
              {matches.map((r) => (
                <li key={r.name}>
                  <button type="button" className="hover:bg-muted flex w-full flex-col px-3 py-2 text-left text-sm" onClick={() => open(r.name)}>
                    <span className="truncate font-medium">{r.title}</span>
                    <span className="text-muted-foreground text-xs">{r.offerId}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q.trim() && matches.length === 0 && <p className="text-muted-foreground text-sm">No products match.</p>}
        </CardContent>
      </Card>

      {product && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Title and description</CardTitle>
              <CardDescription>Suggestions written from the product&apos;s details and image.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <fieldset disabled={!canEdit || pending} className="flex flex-wrap items-end gap-2">
                <F label="Tone" className="w-48">
                  <Pick label="Tone" value={tone} options={TONES} onChange={setTone} />
                </F>
                <F label="Language (optional, 2 letters)" className="w-48">
                  <Input aria-label="Suggestion language" maxLength={2} placeholder={product.contentLanguage ?? "en"} value={lang} onChange={(e) => setLang(e.target.value.toLowerCase().replace(/[^a-z]/g, ""))} />
                </F>
                <Button onClick={suggest}>
                  {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                  Suggest
                </Button>
              </fieldset>
              {!canEdit && <p className="text-muted-foreground text-sm">Your role can&apos;t use Product Studio.</p>}
              {text &&
                (["title", "description"] as const).map((field) => {
                  const s = text[field];
                  if (!s) return null;
                  return (
                    <div key={field} className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                      <F label={`Current ${field}`}>
                        <p className="text-sm whitespace-pre-line">{(attrs[field] as string) || "—"}</p>
                      </F>
                      <F label={`Suggested ${field}`}>
                        <p className="text-sm whitespace-pre-line">{s.text}</p>
                        {s.summary && <p className="text-muted-foreground text-xs">{s.summary}</p>}
                        <Button size="sm" variant="outline" className="mt-1 self-start" disabled={pending} onClick={() => apply(field)}>
                          Use this {field}
                        </Button>
                      </F>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image</CardTitle>
              <CardDescription>Edit the product&apos;s main image. The result opens as a new image you can download and use in your feed.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!imageLink ? (
                <p className="text-muted-foreground text-sm">This product has no image link.</p>
              ) : (
                <>
                  <fieldset disabled={!canEdit || pending} className="flex flex-wrap items-end gap-2">
                    <F label="Tool" className="w-72">
                      <Pick label="Image tool" value={tool} options={TOOLS} onChange={setTool} />
                    </F>
                    {tool === "background" && (
                      <F label="Background" className="w-full sm:w-80">
                        <Input aria-label="Background description" placeholder="e.g. on a marble kitchen counter" value={scene} onChange={(e) => setScene(e.target.value)} />
                      </F>
                    )}
                    <Button onClick={runImage}>
                      {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
                      Generate
                    </Button>
                  </fieldset>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <F label="Current">
                      {/* eslint-disable-next-line @next/next/no-img-element -- the store's own image host */}
                      <img src={imageLink} alt="Current product image" className="max-h-80 rounded-md border object-contain" />
                    </F>
                    {image && (
                      <F label="Generated">
                        {/* eslint-disable-next-line @next/next/no-img-element -- generated by Google */}
                        <img src={image} alt="Generated product image" className="max-h-80 rounded-md border object-contain" />
                        <a href={image} target="_blank" rel="noreferrer" download="product-image.png" className="inline-flex w-fit items-center gap-1 text-sm underline underline-offset-4">
                          Open or download <ExternalLinkIcon className="size-3" />
                        </a>
                      </F>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
