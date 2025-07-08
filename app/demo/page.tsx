import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function DemoPage() {
  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-4xl font-bold">shadcn/ui Components Demo</h1>

      {/* Button Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap gap-4">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">🔔</Button>
        </div>
      </section>

      {/* Card Examples */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Simple Card</CardTitle>
              <CardDescription>This is a basic card component</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Card content goes here. You can add any content you like.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Card with Footer</CardTitle>
              <CardDescription>A card with footer actions</CardDescription>
            </CardHeader>
            <CardContent>
              <p>This card includes a footer with action buttons.</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Cancel</Button>
              <Button size="sm" variant="default">
                Save
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
              <CardDescription>Click the buttons below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p>This card demonstrates various button styles.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    Option 1
                  </Button>
                  <Button size="sm" variant="outline">
                    Option 2
                  </Button>
                  <Button size="sm" variant="outline">
                    Option 3
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Primary Action</Button>
            </CardFooter>
          </Card>
        </div>
      </section>

      {/* Dark Mode Test */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Theme Testing</h2>
        <p className="text-muted-foreground">
          Toggle your system dark mode to see the theme change automatically.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Theme-aware Card</CardTitle>
            <CardDescription>This card adapts to your system theme preference</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p>
                Background: <span className="text-muted-foreground">var(--background)</span>
              </p>
              <p>
                Foreground: <span className="text-muted-foreground">var(--foreground)</span>
              </p>
              <p>
                Primary: <span className="text-muted-foreground">var(--primary)</span>
              </p>
              <p>
                Border: <span className="text-muted-foreground">var(--border)</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
