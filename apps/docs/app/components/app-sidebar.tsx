import { Package } from "lucide-react";
import { Link, useLocation } from "react-router";
import { GithubIcon } from "~/components/icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "~/components/ui/sidebar";
import { getPage, navigation } from "~/nav.config";

export function AppSidebar() {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const currentPath = getPage(location.pathname)?.href ?? location.pathname;

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="max-md:min-h-11"
              render={<Link to="/" onClick={() => setOpenMobile(false)} />}
            >
              <span className="font-heading text-base font-bold tracking-[-0.02em]">
                effect-boxes
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <nav aria-label="Documentation">
          {navigation.map((section) => (
            <SidebarGroup key={section.title}>
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        className="max-md:min-h-11"
                        render={
                          <Link
                            to={item.href}
                            onClick={() => setOpenMobile(false)}
                            aria-current={
                              currentPath === item.href ? "page" : undefined
                            }
                          />
                        }
                        isActive={currentPath === item.href}
                      >
                        {item.label}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between py-2">
          <a
            href="https://lloydrichards.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center max-md:min-h-11 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            lloydrichards.dev
          </a>
          <div className="flex items-center gap-1 md:gap-3">
            <a
              href="https://github.com/lloydrichards/effect-boxes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center max-md:size-11 text-muted-foreground hover:text-foreground transition-colors"
              title="GitHub"
            >
              <GithubIcon className="size-4" />
            </a>
            <a
              href="https://www.npmjs.com/package/effect-boxes"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center max-md:size-11 text-muted-foreground hover:text-foreground transition-colors"
              title="npm"
            >
              <Package className="size-4" />
            </a>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
