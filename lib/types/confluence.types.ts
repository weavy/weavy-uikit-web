export type ConfluenceResourceResultType = {
  resources: ConfluenceResourceType[];
};

export type ConfluenceContentResultType = {
  url: string;
  cloudId: string;
  results: ConfluenceContentType[];
};

export type ConfluenceResourceType = {
  id: string;
  name: string;
  url: string;
  avatarUrl: string;
};

export type ConfluenceContentType = {
  id: string;
  key: string;
  name: string;
  title: string;
  _links: ConfluenceContentLinkType;
};

export type ConfluenceContentLinkType = {
  webui: string;
};

export type ConfluencePageProps = {
  url: string;
  id: string;
  title: string;
  hostname: string;
  spaceKey: string;
};
