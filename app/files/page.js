import MediaLibrary from '../components/media-library';

export const metadata = {
  title: 'My Files | ENotes',
  description: 'Privately organize images and PDFs in ENotes.',
};

export default function FilesPage() {
  return <main className="shell media-library-shell"><MediaLibrary /></main>;
}
